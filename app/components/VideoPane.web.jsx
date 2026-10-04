import { useEffect, useRef, useState } from "react"
import { View } from "react-native"
import TrackPlayer from "react-native-track-player"
import { finished } from "../player/controller"
import { giveBack, takeOver } from "../player/handoff"
import { Text } from "./ui/Text"

// The web's own: a <video>. A fetched file plays in it as it is. The server's
// stream (HLS; Firefox and Chrome don't play it themselves) goes through
// hls.js: tried against shaka-player on this relay, it was the one that
// played, in both, and it repackages YouTube's MPEG-TS segments in a worker,
// off the page's thread. While open the picture is the player, as on a phone
// (player/handoff.js).
export function VideoPane({ itemId, url, stream }) {
	const element = useRef(null)
	const [failed, setFailed] = useState(false)

	useEffect(() => {
		const video = element.current
		let open = true
		let hls = null
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

		attach(video, url, stream, () => setFailed(true))
			.then((attached) => {
				hls = attached
				if (open) return takeOver(pictureOf(video), () => open)
				hls?.destroy()
			})
			.catch(() => setFailed(true))

		return () => {
			open = false
			for (const name of events) video.removeEventListener(name, keep)
			video.removeEventListener("ended", finished)
			giveBack(itemId, last.at, last.playing).catch(() => undefined)
			hls?.destroy()
		}
	}, [itemId, url, stream])

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

// The file as it is, or the stream through hls.js — its full build: the light
// one can't play an audio track that comes separately, as YouTube's does, and
// only the UMD build runs its worker. Resolves once there's something to play.
async function attach(video, url, stream, onFail) {
	if (!stream) {
		video.src = url
		return null
	}
	const { default: Hls } = await import("hls.js/dist/hls.min.js")
	if (!Hls.isSupported()) {
		video.src = url
		return null
	}
	// Fetch from where the audio is, not from the top.
	const { position } = await TrackPlayer.getProgress()
	const hls = new Hls({ startPosition: position, backBufferLength: 90 })
	await new Promise((resolve, reject) => {
		hls.on(Hls.Events.MANIFEST_PARSED, resolve)
		hls.on(Hls.Events.ERROR, (_event, data) => {
			if (!data.fatal) return
			reject(new Error(data.details))
			onFail()
		})
		hls.loadSource(url)
		hls.attachMedia(video)
	})
	return hls
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
