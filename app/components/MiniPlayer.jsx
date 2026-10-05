import { clock } from "@murmur/core"
import { useRouter } from "expo-router"
import RotateCcw from "lucide-react-native/icons/rotate-ccw"
import { Pressable, View } from "react-native"
import { useIsPlaying, useProgress } from "react-native-track-player"
import { SKIP_BACK_S, skipBack, toggle } from "../player/controller"
import { useCurrentId, useItem } from "../store/hooks"
import { Artwork } from "./Artwork"
import { cn } from "./ui/cn"
import { COLUMN } from "./ui/column"
import { IconButton } from "./ui/IconButton"
import { PlayPauseButton } from "./ui/PlayPauseButton"
import { ProgressLine } from "./ui/ProgressLine"
import { Text } from "./ui/Text"

// Above the tabs, while something is loaded: what it is, how far along, and
// the two buttons that matter. Tap anywhere else to open Now Playing.
export function MiniPlayer() {
	const router = useRouter()
	const currentId = useCurrentId()
	const item = useItem(currentId)
	const { position, duration } = useProgress(500)
	const { playing } = useIsPlaying()
	if (!currentId || !item?.url) return null

	const total = duration || item.duration || 0
	return (
		<Pressable
			onPress={() => router.push("/now")}
			accessibilityLabel="Now playing"
			className="bg-surface-container-low active:bg-surface-container web:hover:bg-surface-container"
		>
			<ProgressLine fraction={total > 0 ? position / total : 0} className="rounded-none" />
			<View className={cn(COLUMN, "flex-row items-center gap-sm py-xs")}>
				<Artwork uri={item.thumbnail} className="h-art w-art rounded-2xs" />
				<View className="flex-1 gap-3xs">
					<Text variant="line" numberOfLines={1} className="font-body-medium">
						{item.title || "Fetching details…"}
					</Text>
					<Text variant="data" numberOfLines={1}>
						{item.channel ? `${item.channel} · ` : ""}−{clock(Math.max(0, total - position))}
					</Text>
				</View>
				<IconButton as={RotateCcw} size="sm" label={`Back ${SKIP_BACK_S} seconds`} onPress={skipBack} />
				<PlayPauseButton size="sm" playing={playing} onPress={toggle} />
			</View>
		</Pressable>
	)
}
