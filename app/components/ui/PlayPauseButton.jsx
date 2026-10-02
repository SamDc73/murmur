import { cva } from "class-variance-authority"
import Pause from "lucide-react-native/icons/pause"
import Play from "lucide-react-native/icons/play"
import { Pressable } from "react-native"
import { cn } from "./cn"
import { Icon } from "./Icon"

// The one round, filled button: play or pause. Three sizes — the mini
// player's, a header's, and Now Playing's.
const button = cva("items-center justify-center rounded-full bg-primary active:opacity-80", {
	variants: { size: { sm: "h-tap w-tap", md: "h-tap-lg w-tap-lg", lg: "h-play w-play" } },
	defaultVariants: { size: "md" },
})
const glyph = cva("text-on-primary", {
	variants: { size: { sm: "h-icon w-icon", md: "h-icon-lg w-icon-lg", lg: "h-icon-xl w-icon-xl" } },
	defaultVariants: { size: "md" },
})

export function PlayPauseButton({ playing, size, disabled, className, onPress }) {
	return (
		<Pressable
			role="button"
			accessibilityLabel={playing ? "Pause" : "Play"}
			disabled={disabled}
			onPress={onPress}
			hitSlop={6}
			className={cn(button({ size }), disabled && "opacity-40", className)}
		>
			<Icon
				as={playing ? Pause : Play}
				className={cn(glyph({ size }), !playing && "translate-x-px")}
				fill="currentColor"
				strokeWidth={1.5}
			/>
		</Pressable>
	)
}
