import { copiesByItem, introEnd, nextUp, parseChapters, previousOf, queueOf, setting, TABLES, VALUES } from "@murmur/core"
import TrackPlayer, { AppKilledPlaybackBehavior, Capability, Event, RepeatMode, State } from "react-native-track-player"
import { LOCAL_KEYS } from "../store/local"
import { picture } from "./picture"
import { sourceFor } from "./source"

// The bridge between the store and the track player, attached once per
// runtime and never torn down. The player only ever holds one episode: the
// store's `currentItemId`. When it ends, it goes to History and the bridge
// loads whatever the queue says is next. Positions flow back into the rows,
// so any device can pick up where this one left off. Screens call the
// handful of functions at the bottom; they never call TrackPlayer themselves.

const PROGRESS_EVERY_S = 5
const ENDED_WITHIN_S = 3
// "Previous" this far into an episode restarts it instead.
const RESTART_AFTER_S = 5
// The two jumps, on every surface: buttons, notification, headset.
export const SKIP_BACK_S = 15
export const SKIP_FORWARD_S = 30

let ctx = null

export async function attachPlayer({ store, local }) {
	if (ctx !== null) return
	ctx = { store, local, loaded: null, wantPlay: false, lastSaved: -1, syncing: Promise.resolve() }
	try {
		await TrackPlayer.setupPlayer({
			// media3 owns audio focus — calls, navigation prompts, other apps —
			// the way Android 17's background-audio rules expect.
			autoHandleInterruptions: true,
			// Keep the CPU awake while playing with the screen off (WAKE_MODE_LOCAL);
			// track-player 5 turns media3's default off unless asked.
			androidWakeMode: 1,
		})
	} catch (error) {
		// Already set up (Fast Refresh, or the service beat us to it).
		if (!String(error?.message ?? "").includes("already")) throw error
	}
	await applyOptions()
	// One episode at a time, and it never repeats — pinned here so nothing a
	// platform defaults to can loop it.
	await TrackPlayer.setRepeatMode(RepeatMode.Off)

	store.addValueListener(VALUES.currentItemId, sync)
	store.addTableListener(TABLES.items, sync)
	store.addTableListener(TABLES.copies, sync)
	store.addValueListener(VALUES.playbackRate, applyRate)
	local.addValueListener(LOCAL_KEYS.serverUrl, sync)
	local.addValueListener(LOCAL_KEYS.token, sync)

	TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, ({ position }) => {
		if (Math.abs(position - ctx.lastSaved) >= PROGRESS_EVERY_S - 1) savePosition(position)
	})
	TrackPlayer.addEventListener(Event.PlaybackState, onState)
	TrackPlayer.addEventListener(Event.PlaybackError, (error) => console.warn("[player] error", error))

	sync()
}

async function applyOptions() {
	await TrackPlayer.updateOptions({
		android: {
			appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
			alwaysPauseOnInterruption: true,
		},
		capabilities: [
			Capability.Play,
			Capability.Pause,
			Capability.SkipToNext,
			Capability.SkipToPrevious,
			Capability.JumpForward,
			Capability.JumpBackward,
			Capability.SeekTo,
			Capability.Stop,
		],
		notificationCapabilities: [
			Capability.JumpBackward,
			Capability.Play,
			Capability.Pause,
			Capability.JumpForward,
			Capability.SkipToNext,
			Capability.SeekTo,
		],
		forwardJumpInterval: SKIP_FORWARD_S,
		backwardJumpInterval: SKIP_BACK_S,
		progressUpdateEventInterval: PROGRESS_EVERY_S,
	})
}

async function applyRate() {
	const rate = Number(setting(ctx.store.getValues(), VALUES.playbackRate)) || 1
	try {
		await TrackPlayer.setRate(rate)
	} catch {
		// nothing loaded yet; the rate is applied on the next load
	}
}

const currentId = () => setting(ctx.store.getValues(), VALUES.currentItemId)
const queue = () => queueOf(ctx.store.getTable(TABLES.items))

// ---- store → player -------------------------------------------------------

// Store changes arrive in bursts (download progress, a sync); they are handled
// one at a time, in order, and most of them change nothing.
function sync() {
	ctx.syncing = ctx.syncing.then(loadCurrent).catch((error) => console.warn("[player] sync failed", error))
}

/** The track the player should hold now, or null for nothing. */
function wantedTrack() {
	const { store, local } = ctx
	const id = currentId()
	if (!id || !store.hasRow(TABLES.items, id)) return null
	const copies = copiesByItem(store.getTable(TABLES.copies))[id] ?? {}
	const source = sourceFor({
		copies,
		deviceId: local.getValue(LOCAL_KEYS.deviceId),
		serverUrl: local.getValue(LOCAL_KEYS.serverUrl),
		token: local.getValue(LOCAL_KEYS.token),
	})
	if (source === null) return null
	const row = store.getRow(TABLES.items, id)
	return {
		id,
		url: source.url,
		title: row.title || "Fetching…",
		artist: row.channel || "YouTube",
		artwork: row.thumbnail || undefined,
		duration: row.duration || undefined,
	}
}

async function loadCurrent() {
	const track = wantedTrack()
	const loaded = ctx.loaded
	if (track === null) {
		if (loaded !== null) {
			await keepPosition(loaded.id)
			ctx.loaded = null
			await TrackPlayer.reset()
		}
		return
	}
	if (loaded?.id === track.id && loaded.url === track.url) {
		if (loaded.title !== track.title || loaded.artwork !== track.artwork) {
			ctx.loaded = track
			const { title, artist, artwork } = track
			await TrackPlayer.updateMetadataForTrack(0, { title, artist, artwork }).catch(() => undefined)
		}
		if (ctx.wantPlay) await startPlaying()
		return
	}
	// A new episode — or the same one from a new place (a phone copy finished,
	// the server moved): it starts where it was left, and keeps playing if the
	// player was playing.
	const { state } = await TrackPlayer.getPlaybackState()
	const wasPlaying = state === State.Playing || state === State.Buffering || state === State.Loading
	if (loaded !== null && loaded.id !== track.id) await keepPosition(loaded.id)
	const position = loaded?.id === track.id ? (await TrackPlayer.getProgress()).position : resumeAt(track.id)
	// Nothing is "loaded" while it loads, so the player's own state changes
	// in between can't write one episode's position into another.
	ctx.loaded = null
	await TrackPlayer.load(track)
	if (position > 0) await TrackPlayer.seekTo(position)
	ctx.loaded = track
	ctx.lastSaved = position
	await applyRate()
	if (ctx.wantPlay || wasPlaying) await startPlaying()
}

async function startPlaying() {
	ctx.wantPlay = false
	await TrackPlayer.play()
}

/**
 * Where an episode picks up: its saved position, unless that was the end —
 * and past its intro, if it would start in one and Skip intros is on. Only
 * here, as it loads: seeking back into an intro plays it.
 */
function resumeAt(id) {
	const row = ctx.store.getRow(TABLES.items, id)
	const duration = Number(row.duration) || 0
	const saved = Number(row.position) || 0
	const position = duration > 0 && saved >= duration - ENDED_WITHIN_S ? 0 : saved
	const intro = setting(ctx.store.getValues(), VALUES.skipIntro) ? introEnd(parseChapters(row)) : 0
	return Math.max(position, intro)
}

// ---- player → store -------------------------------------------------------

function savePosition(position) {
	const id = ctx.loaded?.id
	if (!id || !ctx.store.hasRow(TABLES.items, id)) return
	ctx.lastSaved = position
	ctx.store.setCell(TABLES.items, id, "position", Math.floor(position))
}

/** Leaving an episode half-heard: remember where, unless it already went to History. */
async function keepPosition(id) {
	if (!ctx.store.hasRow(TABLES.items, id) || ctx.store.getCell(TABLES.items, id, "doneAt")) return
	const { position } = await TrackPlayer.getProgress()
	if (position > 0) ctx.store.setCell(TABLES.items, id, "position", Math.floor(position))
}

async function onState({ state }) {
	if (state === State.Ended) return finished()
	const id = ctx.loaded?.id
	if (!id || (state !== State.Paused && state !== State.Stopped)) return
	const { position } = await TrackPlayer.getProgress()
	if (ctx.loaded?.id === id) savePosition(position)
}

// The episode played to the end: it goes to History, and the one below it
// starts. After the last one, nothing — the queue stops, no wrap. A video
// playing to its end (VideoPane) lands here too.
export function finished() {
	const { store } = ctx
	const id = ctx.loaded?.id
	if (!id || id !== currentId()) return
	const following = nextUp(queue(), id)
	ctx.wantPlay = following !== ""
	store.transaction(() => {
		if (store.hasRow(TABLES.items, id)) {
			const duration = Number(store.getCell(TABLES.items, id, "duration")) || 0
			store.setPartialRow(TABLES.items, id, { doneAt: Date.now(), position: duration })
		}
		store.setValue(VALUES.currentItemId, following)
	})
}

// ---- what screens call ----------------------------------------------------

/** Make `id` the current episode and play it. */
export function requestPlay(id) {
	if (!ctx) return
	ctx.wantPlay = true
	if (currentId() === id) sync()
	else ctx.store.setValue(VALUES.currentItemId, id)
}

/** The episode the player is on, or "". */
export function currentEpisode() {
	return ctx ? currentId() : ""
}

// Play, pause and the jumps drive the picture while one is on screen.

export function play() {
	if (!ctx) return
	if (picture()) return picture().play()
	const id = currentId() || nextUp(queue(), "")
	if (id) requestPlay(id)
}

export async function pause() {
	if (picture()) return picture().pause()
	await TrackPlayer.pause()
}

export async function toggle() {
	if (picture()) return picture().playing ? pause() : play()
	const { state } = await TrackPlayer.getPlaybackState()
	if (state === State.Playing || state === State.Buffering || state === State.Loading) return pause()
	return play()
}

export async function seekTo(position) {
	if (picture()) picture().currentTime = Math.max(0, position)
	else await TrackPlayer.seekTo(Math.max(0, position))
}

export async function seekBy(seconds) {
	if (picture()) picture().seekBy(seconds)
	else await TrackPlayer.seekBy(seconds)
}

export const skipBack = () => seekBy(-SKIP_BACK_S)
export const skipForward = () => seekBy(SKIP_FORWARD_S)

/** The episode below this one; this one stays in the queue where it was. */
export function next() {
	if (!ctx) return
	const id = nextUp(queue(), currentId())
	if (id) requestPlay(id)
}

/** Like every podcast app: early on, the episode above; later, the start of this one. */
export async function previous() {
	if (!ctx) return
	const position = picture()?.currentTime ?? (await TrackPlayer.getProgress()).position
	const id = previousOf(queue(), currentId())
	if (position > RESTART_AFTER_S || !id) return seekTo(0)
	requestPlay(id)
}
