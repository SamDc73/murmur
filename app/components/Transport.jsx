import RotateCcw from "lucide-react-native/icons/rotate-ccw"
import RotateCw from "lucide-react-native/icons/rotate-cw"
import SkipBack from "lucide-react-native/icons/skip-back"
import SkipForward from "lucide-react-native/icons/skip-forward"
import { View } from "react-native"
import { next, previous, SKIP_BACK_S, SKIP_FORWARD_S, skipBack, skipForward, toggle } from "../player/controller"
import { IconButton } from "./ui/IconButton"
import { PlayPauseButton } from "./ui/PlayPauseButton"
import { Text } from "./ui/Text"

// Five controls, the big one in the middle; the jumps say how far. The row
// reaches md into each margin, which puts the outer glyphs' strokes — not
// their buttons — on the column's edges, under the scrubber's ends.
export function Transport({ playing }) {
	return (
		<View className="-mx-md flex-row items-center justify-between">
			<IconButton as={SkipBack} size="md" label="Previous" onPress={previous} iconClassName="text-on-surface-variant" />
			<Jump icon={RotateCcw} seconds={SKIP_BACK_S} label={`Back ${SKIP_BACK_S} seconds`} onPress={skipBack} />
			<PlayPauseButton size="lg" playing={playing} onPress={toggle} />
			<Jump
				icon={RotateCw}
				seconds={SKIP_FORWARD_S}
				label={`Forward ${SKIP_FORWARD_S} seconds`}
				onPress={skipForward}
			/>
			<IconButton as={SkipForward} size="md" label="Next" onPress={next} iconClassName="text-on-surface-variant" />
		</View>
	)
}

function Jump({ icon, seconds, label, onPress }) {
	return (
		<View className="items-center">
			<IconButton as={icon} size="md" label={label} onPress={onPress} />
			<Text className="-mt-xs font-mono text-chip text-on-surface-variant">{seconds}</Text>
		</View>
	)
}
