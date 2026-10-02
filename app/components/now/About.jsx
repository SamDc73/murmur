import { ScrollView } from "react-native"
import { Text } from "../ui/Text"

// The description, as the channel wrote it.
export function About({ text }) {
	return (
		<ScrollView contentContainerClassName="px-sm py-xs">
			<Text variant="line" selectable className="leading-relaxed text-on-surface-variant">
				{text}
			</Text>
		</ScrollView>
	)
}
