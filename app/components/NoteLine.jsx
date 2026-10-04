import StickyNote from "lucide-react-native/icons/sticky-note"
import { View } from "react-native"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"

// An episode's note, one line under it in the Queue and History lists.
export function NoteLine({ note }) {
	if (!note) return null
	return (
		<View className="flex-row items-center gap-3xs">
			<Icon as={StickyNote} className="h-icon-sm w-icon-sm text-tertiary" />
			<Text variant="caption" numberOfLines={1} className="flex-shrink text-on-surface-variant">
				{note}
			</Text>
		</View>
	)
}
