import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { cn } from "./ui/cn"
import { COLUMN } from "./ui/column"
import { Text } from "./ui/Text"

// A screen's one heading — Fraunces — with a muted line of figures under it
// and room for one action on the right. No way back: these are tabs. A whole
// step (lg) above it, below the system's own bar; one (md) down to the content.
export function ScreenHeader({ title, lede = null, children = null }) {
	const insets = useSafeAreaInsets()
	return (
		<View style={{ paddingTop: insets.top }}>
			<View className={cn(COLUMN, "flex-row items-end gap-sm pt-lg pb-md")}>
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
		</View>
	)
}
