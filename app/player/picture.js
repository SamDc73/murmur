import { useCallback, useSyncExternalStore } from "react"
import { useIsPlaying, useProgress } from "react-native-track-player"

// While a video is on screen it is the player. The controller's functions
// drive it, and the Now screen reads its clock; the audio waits, paused, and
// carries on from the picture's position when it closes (VideoPane).

let current = null
const listeners = new Set()

/** VideoPane's expo-video player while it shows, else null. */
export function setPicture(player) {
	current = player
	for (const listener of listeners) listener()
}

export const picture = () => current

function subscribe(listener) {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

// expo-video's time and state are plain properties: read them on a clock
// while a picture shows. Undefined when none does.
function useFromPicture(read, everyMs) {
	const video = useSyncExternalStore(subscribe, picture)
	const onTick = useCallback(
		(tick) => {
			if (!video) return () => undefined
			const timer = setInterval(tick, everyMs)
			return () => clearInterval(timer)
		},
		[video, everyMs]
	)
	return useSyncExternalStore(onTick, () => (video ? read(video) : undefined))
}

/** Where playback is: the picture's clock while one shows, else the audio's. */
export function usePosition(everyMs) {
	const audio = useProgress(everyMs)
	const position = useFromPicture(readTime, everyMs)
	const duration = useFromPicture(readDuration, everyMs)
	return position === undefined ? audio : { position, duration: duration || audio.duration }
}

/** Whether what's on screen is playing. */
export function usePlaying() {
	const audio = useIsPlaying()
	const playing = useFromPicture(readPlaying, 250)
	return playing === undefined ? audio : { playing }
}

const readTime = (video) => video.currentTime
const readDuration = (video) => video.duration
const readPlaying = (video) => video.playing
