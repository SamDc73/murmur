import { View } from "react-native"
import { useTokenColour } from "../lib/use-token-colour"
import { MurmurGlyph } from "./icons/MurmurGlyph"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"

// Nothing to show — said once, plainly, with the mark: quiet, its ball at rest.
export function EmptyState({ title, body }) {
	const verdigris = useTokenColour("--color-tertiary")
	return (
		<View className="items-center gap-sm px-xl py-3xl">
			<Icon as={MurmurGlyph} accent={verdigris} className="mb-xs h-2xl w-2xl text-outline" />
			<Text variant="subheading" className="text-center">
				{title}
			</Text>
			{body ? (
				<Text variant="label" className="max-w-copy text-center text-on-surface-variant">
					{body}
				</Text>
			) : null}
		</View>
	)
}
