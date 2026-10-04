import TrackPlayer, { State } from "react-native-track-player"
import { currentEpisode, pause, play, seekTo } from "./controller"
import { setPicture } from "./picture"

// Between listening and watching: the video takes the audio's place and
// position when it opens, and gives both back when it closes. `picture` is
// anything with play(), pause(), currentTime and playing — expo-video's
// player on a phone, the <video> element's stand-in on the web.

/** The audio pauses and the picture starts where it was — playing if the audio was. */
export async function takeOver(picture, stillOpen) {
	const { state } = await TrackPlayer.getPlaybackState()
	await pause()
	const { position } = await TrackPlayer.getProgress()
	if (!stillOpen()) return
	setPicture(picture)
	picture.currentTime = position
	if (state === State.Playing || state === State.Buffering) picture.play()
}

/**
 * The picture closes: the audio picks up where it was, playing if it was —
 * unless the player moved on to another episode meanwhile, which keeps its own place.
 */
export async function giveBack(itemId, at, playing) {
	setPicture(null)
	if (currentEpisode() !== itemId) return
	if (at > 0) await seekTo(at)
	if (playing) await play()
}
