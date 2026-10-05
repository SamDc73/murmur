import { useEventListener } from "expo"
import { useVideoPlayer, VideoView } from "expo-video"
import { useEffect, useRef } from "react"
import { View } from "react-native"
import { finished } from "../player/controller"
import { giveBack, takeOver } from "../player/handoff"

// Watching instead of listening. While open, the picture is the player:
// every control drives it (player/picture.js). It takes the audio's place
// and position on open, and hands both back on close (player/handoff.js).
// `stream`: the server relays YouTube's HLS — no file to wait for.
export function VideoPane({ itemId, url, stream }) {
	// Configuration only: expo-video runs this while rendering, so nothing
	// here may touch the audio player.
	const player = useVideoPlayer(stream ? { uri: url, contentType: "hls" } : url, (instance) => {
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
		takeOver(player, () => open).catch(() => undefined)
		return () => {
			open = false
			const { at, playing } = last.current
			giveBack(itemId, at, playing).catch(() => undefined)
		}
	}, [player, itemId])

	return (
		<View className="w-full overflow-hidden rounded-md bg-surface-container-lowest">
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
