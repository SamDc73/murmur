import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Text } from "./ui/Text"

// A screen's one heading — Fraunces — with a muted line of figures under it
// and room for one action on the right. No way back: these are tabs.
export function ScreenHeader({ title, lede = null, children = null }) {
	const insets = useSafeAreaInsets()
	return (
		<View
			className="mx-auto w-full max-w-page flex-row items-end gap-sm px-md pb-sm"
			style={{ paddingTop: insets.top + 12 }}
		>
			<View className="flex-1 gap-3xs">
				<Text variant="heading">{title}</Text>
				{lede ? (
					<Text variant="data" numberOfLines={1}>
						{lede}
					</Text>
				) : null}
			</View>
			{children}
		</View>
	)
}
