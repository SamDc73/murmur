import TrackPlayer, { Event } from "react-native-track-player"
import { next, pause, play, previous, toggle } from "./controller"

// The headless half of the player: what the notification, the lock screen,
// Bluetooth and headset buttons do. Registered in index.js so it exists even
// when the app was started only to answer a button. Moving between episodes
// goes through the controller — the queue lives in the store, not the player.
export async function playbackService() {
	TrackPlayer.addEventListener(Event.RemotePlay, play)
	TrackPlayer.addEventListener(Event.RemotePause, pause)
	// A headset's single button, on Android.
	TrackPlayer.addEventListener(Event.RemotePlayPause, toggle)
	TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop())
	TrackPlayer.addEventListener(Event.RemoteNext, next)
	TrackPlayer.addEventListener(Event.RemotePrevious, previous)
	TrackPlayer.addEventListener(Event.RemoteJumpForward, ({ interval }) => TrackPlayer.seekBy(interval))
	TrackPlayer.addEventListener(Event.RemoteJumpBackward, ({ interval }) => TrackPlayer.seekBy(-interval))
	TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => TrackPlayer.seekTo(position))
}
