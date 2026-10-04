import { useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { finished } from "../player/controller"
import { giveBack, takeOver } from "../player/handoff"
import { Text } from "./ui/Text"

// The web's own: a <video> fed by shaka-player — the library the audio player
// already loads — so the server's HLS stream plays in every browser (expo-
// video's web player hands a URL to <video> as it is, and only Safari plays
// HLS that way). A downloaded file plays through it all the same. While open
// the picture is the player, as on a phone (player/handoff.js).
export function VideoPane({ itemId, url }) {
	const element = useRef(null)
	const [failed, setFailed] = useState(false)

	useEffect(() => {
		const video = element.current
		let open = true
		let player = null
		// Where it is, kept as it goes, for handing back on close.
		const last = { at: 0, playing: false }
		const keep = () => {
			last.at = video.currentTime
			last.playing = !video.paused
		}
		const events = ["timeupdate", "play", "pause"]
		for (const name of events) video.addEventListener(name, keep)
		// To the end, like the audio: to History, and on to the next one.
		video.addEventListener("ended", finished)

		load(video, url)
			.then((shakaPlayer) => {
				player = shakaPlayer
				if (open) return takeOver(pictureOf(video), () => open)
				player.destroy()
			})
			.catch(() => setFailed(true))

		return () => {
			open = false
			for (const name of events) video.removeEventListener(name, keep)
			video.removeEventListener("ended", finished)
			giveBack(itemId, last.at, last.playing).catch(() => undefined)
			player?.destroy()
		}
	}, [itemId, url])

	return (
		<View className="w-full overflow-hidden rounded-xl bg-surface-container-lowest">
			{/* biome-ignore lint/a11y/useMediaCaption: YouTube's captions are the Transcript tab beside it. */}
			<video
				ref={element}
				controls
				playsInline
				style={{ display: "block", width: "100%", aspectRatio: "16 / 9", background: "black" }}
			/>
			{failed ? (
				<View className="absolute inset-0 items-center justify-center p-md">
					<Text variant="label" className="text-center text-on-camera">
						The video wouldn’t load. Get the video, in the menu, fetches it instead.
					</Text>
				</View>
			) : null}
		</View>
	)
}

async function load(video, url) {
	const shaka = (await import("shaka-player/dist/shaka-player.ui")).default
	shaka.polyfill.installAll()
	const player = new shaka.Player()
	await player.attach(video)
	await player.load(url)
	return player
}

// The <video> as the controller's picture: what expo-video's player offers on a phone.
function pictureOf(video) {
	return {
		play: () => video.play().catch(() => undefined),
		pause: () => video.pause(),
		get currentTime() {
			return video.currentTime
		},
		set currentTime(seconds) {
			video.currentTime = seconds
		},
		get duration() {
			return Number.isFinite(video.duration) ? video.duration : 0
		},
		get playing() {
			return !video.paused
		},
		seekBy: (seconds) => {
			video.currentTime += seconds
		},
	}
}
