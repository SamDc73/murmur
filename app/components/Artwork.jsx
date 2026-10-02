import { Image } from "expo-image"
import { styled } from "nativewind"
import { View } from "react-native"
import { cn } from "./ui/cn"

const Picture = styled(Image, { className: "style" })

// A thumbnail. expo-image caches to disk, so the frame a row shows offline is
// the one it showed online. The box gives the shape; the image fills it.
export function Artwork({ uri, className, ...props }) {
	return (
		<View className={cn("overflow-hidden rounded-sm bg-surface-container-high", className)} {...props}>
			{uri ? (
				<Picture source={{ uri }} className="h-full w-full" contentFit="cover" transition={180} recyclingKey={uri} />
			) : null}
		</View>
	)
}
