import { View } from "react-native"
import { cn } from "./cn"

// On the web a lucide icon copies every prop — className included — onto
// each shape inside its <svg>, so a size class would stretch a <rect> into a
// square (lucide's Pause became one). Here the classes size and colour a box
// instead, and the glyph fills it, drawing in the box's text colour.
export function Icon({ as: Glyph, className, ...props }) {
	return (
		<View className={cn("items-center justify-center", className)} aria-hidden>
			<Glyph size="100%" color="currentColor" {...props} />
		</View>
	)
}
