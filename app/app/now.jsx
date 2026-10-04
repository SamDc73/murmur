import { COPY_STATE, DEVICE_SERVER, MEDIA_KIND, uploadDate, VALUES } from "@murmur/core"
import { useRouter } from "expo-router"
import ChevronDown from "lucide-react-native/icons/chevron-down"
import EllipsisVertical from "lucide-react-native/icons/ellipsis-vertical"
import Music2 from "lucide-react-native/icons/music-2"
import Video from "lucide-react-native/icons/video"
import { useState } from "react"
import { Pressable, useWindowDimensions, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Artwork } from "../components/Artwork"
import { EmptyState } from "../components/EmptyState"
import { ItemMenu } from "../components/ItemMenu"
import { Panels } from "../components/now/Panels"
import { Scrubber } from "../components/Scrubber"
import { Transport } from "../components/Transport"
import { cn } from "../components/ui/cn"
import { Icon } from "../components/ui/Icon"
import { IconButton } from "../components/ui/IconButton"
import { Select } from "../components/ui/Select"
import { Text } from "../components/ui/Text"
import { VideoPane } from "../components/VideoPane"
import { seekTo } from "../player/controller"
import { usePlaying } from "../player/picture"
import { sourceFor } from "../player/source"
import { useActions, useCopies, useCurrentId, useDeviceId, useItem, useLocal, useSetting } from "../store/hooks"
import { LOCAL_KEYS } from "../store/local"

const RATES = [0.8, 1, 1.25, 1.5, 1.75, 2].map((value) => ({ value, label: `${value}×` }))
// Two columns from a small laptop up: the player, and what to read beside it.
const TWO_COLUMNS = 1024

// One episode, whole: the player on top — and the chapters, transcript and
// description underneath (on a phone) or beside it (on a desktop).
export default function NowScreen() {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const window = useWindowDimensions()
	const currentId = useCurrentId()
	const item = useItem(currentId)
	const wide = window.width >= TWO_COLUMNS

	const header = (
		<View className="mx-auto w-full max-w-wide flex-row items-center justify-between px-xs py-2xs">
			<IconButton
				as={ChevronDown}
				size="md"
				label="Close"
				onPress={() => router.back()}
				iconClassName="text-on-surface-variant"
			/>
			<Text variant="eyebrow">now playing</Text>
			{currentId && item?.url ? (
				<ItemMenu
					itemId={currentId}
					where="now"
					trigger={<IconButton as={EllipsisVertical} size="md" label="More" iconClassName="text-on-surface-variant" />}
				/>
			) : (
				<View className="h-tap-lg w-tap-lg" />
			)}
		</View>
	)

	if (!currentId || !item?.url) {
		return (
			<View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
				{header}
				<EmptyState title="Nothing playing" body="Pick something from the queue." />
			</View>
		)
	}

	// The artwork gives way on short screens so the panel below keeps room.
	const column = wide ? 26 * 16 : Math.min(window.width, 32 * 16) - 48
	const artWidth = wide ? column : Math.min(column, window.height * 0.28 * (16 / 9))

	return (
		<View className="flex-1 bg-background" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
			{header}
			<View className={cn("mx-auto w-full max-w-wide flex-1", wide ? "flex-row gap-2xl px-xl pb-lg" : "")}>
				{/* Keyed: a new episode starts out listening. */}
				<Player
					key={currentId}
					item={item}
					itemId={currentId}
					artWidth={artWidth}
					className={wide ? "w-player" : "mx-auto w-full max-w-player px-lg"}
				/>
				<Panels itemId={currentId} item={item} className={wide ? "pt-xs" : "mx-auto mt-sm w-full max-w-page px-sm"} />
			</View>
		</View>
	)
}

function Player({ item, itemId, artWidth, className }) {
	const copies = useCopies(itemId)
	const deviceId = useDeviceId()
	const serverUrl = useLocal(LOCAL_KEYS.serverUrl)
	const token = useLocal(LOCAL_KEYS.token)
	const rate = useSetting(VALUES.playbackRate)
	const { setSetting } = useActions()
	const { playing } = usePlaying()
	const [watching, setWatching] = useState(false)
	const source = sourceFor({ copies, deviceId, serverUrl, token })
	const server = copies[DEVICE_SERVER]
	const meta = [item.channel, uploadDate(item.uploadDate)].filter(Boolean).join(" · ")

	return (
		<View className={cn("gap-md", className)}>
			<View className="items-center">
				{watching && source?.kind === MEDIA_KIND.video ? (
					<View style={{ width: artWidth }}>
						<VideoPane itemId={itemId} url={source.url} />
					</View>
				) : (
					<Artwork uri={item.thumbnail} className="rounded-xl" style={{ width: artWidth, aspectRatio: 16 / 9 }} />
				)}
			</View>
			<View className="gap-3xs">
				<Text variant="subheading" numberOfLines={2}>
					{item.title || "Fetching details…"}
				</Text>
				{meta ? <Text variant="data">{meta}</Text> : null}
			</View>
			{/* Speed (and Watch, when there is video) sit between the two times. */}
			<Scrubber fallbackDuration={item.duration || 0} onSeek={seekTo}>
				<Select
					label="Speed"
					value={rate}
					options={RATES}
					onChange={(value) => setSetting(VALUES.playbackRate, value)}
				/>
				{source?.kind === MEDIA_KIND.video ? (
					<Pressable
						role="switch"
						accessibilityState={{ checked: watching }}
						onPress={() => setWatching((value) => !value)}
						className="flex-row items-center gap-3xs rounded-md px-xs py-2xs active:bg-surface-container web:hover:bg-surface-container"
					>
						<Icon as={watching ? Music2 : Video} className="h-icon-sm w-icon-sm text-on-surface-variant" />
						<Text variant="mono" className="text-on-surface">
							{watching ? "Listen" : "Watch"}
						</Text>
					</Pressable>
				) : null}
			</Scrubber>
			<Transport playing={playing} />
			{server?.state === COPY_STATE.downloading ? (
				<Text variant="data" className="text-center">
					still downloading · {Math.round((server.progress || 0) * 100)}%
				</Text>
			) : null}
		</View>
	)
}
