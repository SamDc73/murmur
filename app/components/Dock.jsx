import { View } from "react-native"
import { useWide } from "../lib/wide"
import { MiniPlayer } from "./MiniPlayer"
import { Bar } from "./SectionBar"

// The bottom chrome the Tabs layout renders as its tabBar: the mini player,
// and the bar on a phone. Wide screens navigate from the rail instead.
export function Dock(props) {
	const wide = useWide()
	return (
		<View className="border-t border-outline-variant bg-surface">
			<MiniPlayer />
			{wide ? null : <Bar {...props} />}
		</View>
	)
}
