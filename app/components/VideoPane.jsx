import { useEventListener } from "expo"
import { useVideoPlayer, VideoView } from "expo-video"
import { useEffect, useRef } from "react"
import { View } from "react-native"
import TrackPlayer, { State } from "react-native-track-player"
import { currentEpisode, finished, pause, play, seekTo } from "../player/controller"
import { setPicture } from "../player/picture"

// Watching instead of listening. While open, the picture is the player:
// every control drives it (player/picture.js). It takes the audio's place
// and position on open, and hands both back on close — playing, if it was.
export function VideoPane({ itemId, url }) {
	// Configuration only: expo-video runs this while rendering, so nothing
	// here may touch the audio player.
	const player = useVideoPlayer(url, (instance) => {
		instance.timeUpdateEventInterval = 0.5
		instance.staysActiveInBackground = false
		instance.showNowPlayingNotification = false
		instance.loop = false
	})

	// To the end, like the audio: to History, and on to the next one.
	useEventListener(player, "playToEnd", finished)
	// Where it is, kept as it goes: by the time this pane's cleanup runs,
	// expo-video has already released the player, and reading it would throw.
	const last = useRef({ at: 0, playing: false })
	useEventListener(player, "timeUpdate", ({ currentTime }) => {
		last.current.at = currentTime
	})
	useEventListener(player, "playingChange", ({ isPlaying }) => {
		last.current.playing = isPlaying
	})

	useEffect(() => {
		let open = true
		takeOver(player, () => open).catch(() => {
			// the audio player may have nothing loaded
		})
		return () => {
			open = false
			const { at, playing } = last.current
			setPicture(null)
			// Moved on to another episode meanwhile: that one keeps its own place.
			if (currentEpisode() !== itemId) return
			handBack(at, playing).catch(() => {
				// the audio player may have nothing loaded
			})
		}
	}, [player, itemId])

	return (
		<View className="w-full overflow-hidden rounded-xl bg-surface-container-lowest">
			<VideoView
				player={player}
				style={{ width: "100%", aspectRatio: 16 / 9 }}
				nativeControls
				allowsPictureInPicture
				contentFit="contain"
			/>
		</View>
	)
}

// The audio pauses and the picture starts where it was — playing if the
// audio was. (Seeking is a write to the player object — expo-video's API —
// so it lives out here, in the effect's helper, not in render.)
async function takeOver(player, stillOpen) {
	const { state } = await TrackPlayer.getPlaybackState()
	await pause()
	const { position } = await TrackPlayer.getProgress()
	if (!stillOpen()) return
	setPicture(player)
	player.currentTime = position
	if (state === State.Playing || state === State.Buffering) player.play()
}

async function handBack(at, playing) {
	if (at > 0) await seekTo(at)
	if (playing) await play()
}
