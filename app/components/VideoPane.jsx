import { useVideoPlayer, VideoView } from "expo-video"
import { useEffect } from "react"
import { View } from "react-native"
import TrackPlayer from "react-native-track-player"
import { pause, play, seekTo } from "../player/controller"

// Watching instead of listening. The audio player hands its position over on
// open and takes it back on close — still playing, if the picture was; only
// one of them ever plays.
export function VideoPane({ url }) {
	// Configuration only: expo-video runs this while rendering, so nothing
	// here may touch the audio player.
	const player = useVideoPlayer(url, (instance) => {
		instance.timeUpdateEventInterval = 1
		instance.staysActiveInBackground = false
		instance.showNowPlayingNotification = false
		instance.loop = false
	})

	// Opening takes over from the audio; closing hands the position back.
	useEffect(() => {
		let open = true
		takeOver(player, () => open).catch(() => {
			// the audio player may have nothing loaded
		})
		return () => {
			open = false
			const at = player.currentTime
			const playing = player.playing
			player.pause()
			handBack(at, playing).catch(() => {
				// the audio player may have nothing loaded
			})
		}
	}, [player])

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

// The audio pauses and the picture starts where it was. (Seeking is a write
// to the player object — expo-video's API — so it lives out here, in the
// effect's helper, not in render.)
async function takeOver(player, stillOpen) {
	await pause()
	const { position } = await TrackPlayer.getProgress()
	if (!stillOpen()) return
	player.currentTime = position
	player.play()
}

async function handBack(at, playing) {
	if (at > 0) await seekTo(at)
	if (playing) await play()
}
