import { clock } from "@murmur/core"
import { View } from "react-native"
import { Artwork } from "./Artwork"
import { Text } from "./ui/Text"

// A row's thumbnail: the frame, its length in the corner (as YouTube draws
// it), and — for the one playing — a hairline of progress along the bottom.
export function Thumb({ uri, duration, fraction }) {
	return (
		<View className="h-thumb-h w-thumb overflow-hidden rounded-md">
			<Artwork uri={uri} className="h-full w-full rounded-none" />
			{duration > 0 ? (
				<View className="absolute right-3xs bottom-3xs rounded-xs bg-inverse-surface px-3xs">
					<Text className="font-mono text-chip text-inverse-on-surface">{clock(duration)}</Text>
				</View>
			) : null}
			{fraction !== undefined ? (
				<View className="absolute right-0 bottom-0 left-0 h-3xs bg-outline-variant">
					<View className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, fraction * 100))}%` }} />
				</View>
			) : null}
		</View>
	)
}
