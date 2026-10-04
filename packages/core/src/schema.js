// The one description of what is stored. Every surface — phone, web, server —
// reads and writes the same TinyBase MergeableStore, so the names live here
// and nowhere else. TinyBase cells are string | number | boolean: "" and 0
// stand for "not yet", never null.

export const TABLES = {
	// One row per episode, queued or played. `doneAt === 0` means it is still
	// in the queue; anything else is history. `order` is a fractional index —
	// the queue plays in ascending order, and moving a row rewrites only its key.
	items: "items",
	// One row per (item, device) that holds — or is fetching — the media file.
	// The server is a device too: its id is DEVICE_SERVER.
	copies: "copies",
	// Every device that has ever synced, so a copy can be named ("on Pixel 9").
	devices: "devices",
}

export const DEVICE_SERVER = "server"

export const COPY_STATE = {
	pending: "pending",
	downloading: "downloading",
	ready: "ready",
	error: "error",
	// The server let its file go because downloadTarget is "phone" and a phone
	// has it. Re-queueing the item downloads it again.
	evicted: "evicted",
}

export const MEDIA_KIND = { audio: "audio", video: "video" }

// Values (store-wide settings). Synced, so every device agrees on them.
export const VALUES = {
	currentItemId: "currentItemId",
	// The server keeps its file. Off: once a phone has the file, the server
	// lets its copy go — the phone becomes the only place it lives.
	keepOnServer: "keepOnServer",
	// 0 fetches audio only; 480/720/1080 fetches video up to that height.
	videoHeight: "videoHeight",
	audioFormat: "audioFormat",
	playbackRate: "playbackRate",
}

const DEFAULT_VALUES = {
	[VALUES.currentItemId]: "",
	[VALUES.keepOnServer]: true,
	[VALUES.videoHeight]: 0,
	// m4a is AAC in an MP4 box: native on Android's ExoPlayer and every browser,
	// and yt-dlp can pull it without re-encoding. opus is smaller; also native.
	[VALUES.audioFormat]: "m4a",
	[VALUES.playbackRate]: 1,
}

export const AUDIO_FORMATS = ["m4a", "opus"]
export const VIDEO_HEIGHTS = [0, 480, 720, 1080]

/** What the server should fetch for an item: its own wish, else the setting. */
export function wantedKind(row, values) {
	return row.wantKind || (setting(values, VALUES.videoHeight) > 0 ? MEDIA_KIND.video : MEDIA_KIND.audio)
}

// A fresh item, straight from a pasted link. The server fills the rest.
export function newItem({ url, videoId, order, addedAt }) {
	return {
		url,
		source: "youtube",
		videoId,
		order,
		addedAt,
		title: "",
		channel: "",
		channelUrl: "",
		duration: 0,
		thumbnail: "",
		description: "",
		chapters: "[]",
		uploadDate: "",
		// Captions: the track to fetch (from the probe), and the transcript's
		// language once the server has saved it. `transcriptTried` stops a
		// track that cannot be fetched from being asked for again and again.
		captionLang: "",
		captionAuto: false,
		transcript: "",
		transcriptTried: 0,
		resolvedAt: 0,
		error: "",
		doneAt: 0,
		position: 0,
		// Yours: a plain note on the episode, typed while listening.
		note: "",
	}
}

export function copyId(itemId, deviceId) {
	return `${itemId}:${deviceId}`
}

/** The copies table regrouped: itemId → { deviceId → copy }. One pass. */
export function copiesByItem(copiesTable) {
	const byItem = {}
	for (const copy of Object.values(copiesTable)) {
		byItem[copy.itemId] ??= {}
		byItem[copy.itemId][copy.deviceId] = copy
	}
	return byItem
}

export function newCopy({ itemId, deviceId, kind, updatedAt }) {
	return {
		itemId,
		deviceId,
		kind,
		state: COPY_STATE.pending,
		progress: 0,
		bytes: 0,
		uri: "",
		error: "",
		updatedAt,
	}
}

export function parseChapters(item) {
	try {
		const parsed = JSON.parse(item.chapters || "[]")
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

// A value with its default. Defaults are never written into the store: a
// seeded default carries a timestamp, and on first sync it could outrank a
// choice the user made earlier on another device.
export function setting(values, key) {
	const value = values?.[key]
	if (value === undefined || value === null || value === "") return DEFAULT_VALUES[key]
	return value
}
