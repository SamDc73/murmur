import { View } from "react-native"
import { cn } from "./cn"

// A hairline of progress: under a thumbnail, along the top of the dock. The
// fill's width is the one computed layout value.
export function ProgressLine({ fraction, className }) {
	const width = `${Math.round(Math.min(1, Math.max(0, Number(fraction) || 0)) * 1000) / 10}%`
	return (
		<View className={cn("h-3xs w-full overflow-hidden rounded-xl bg-outline-variant", className)}>
			<View className="h-full bg-primary" style={{ width }} />
		</View>
	)
}
