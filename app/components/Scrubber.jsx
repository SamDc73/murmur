import { clock } from "@murmur/core"
import { useEffect, useRef } from "react"
import { View } from "react-native"
import { Slider } from "react-native-awesome-slider"
import { useSharedValue } from "react-native-reanimated"
import { useProgress } from "react-native-track-player"
import { useTokenColour } from "../lib/use-token-colour"
import { Text } from "./ui/Text"

// The one gesture that moves through an episode. The track follows playback
// until a finger is on it; on release it seeks once. It reads the player's
// clock itself, so only it redraws four times a second — not the screen.
export function Scrubber({ fallbackDuration = 0, onSeek, children = null }) {
	const { position, duration: playing } = useProgress(250)
	const duration = playing || fallbackDuration
	const progress = useSharedValue(position)
	const min = useSharedValue(0)
	const max = useSharedValue(Math.max(1, duration))
	const scrubbing = useRef(false)
	const primary = useTokenColour("--color-primary")
	const track = useTokenColour("--color-outline-variant")
	const buffered = useTokenColour("--color-surface-container-highest")

	useEffect(() => {
		max.value = Math.max(1, duration)
		if (!scrubbing.current) progress.value = position
	}, [position, duration, progress, max])

	return (
		<View className="gap-2xs">
			<Slider
				progress={progress}
				minimumValue={min}
				maximumValue={max}
				onSlidingStart={() => {
					scrubbing.current = true
				}}
				onSlidingComplete={(value) => {
					scrubbing.current = false
					onSeek(value)
				}}
				renderBubble={() => null}
				thumbWidth={14}
				sliderHeight={4}
				containerStyle={{ borderRadius: 2 }}
				theme={{
					minimumTrackTintColor: primary,
					maximumTrackTintColor: track,
					cacheTrackTintColor: buffered,
					bubbleBackgroundColor: primary,
				}}
			/>
			<View className="flex-row items-center justify-between">
				<Text variant="mono" className="text-on-surface-variant">
					{clock(position)}
				</Text>
				{children ? <View className="flex-row items-center gap-2xs">{children}</View> : null}
				<Text variant="mono" className="text-on-surface-variant">
					−{clock(Math.max(0, duration - position))}
				</Text>
			</View>
		</View>
	)
}
