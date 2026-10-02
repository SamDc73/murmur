import ArrowDownToLine from "lucide-react-native/icons/arrow-down-to-line"
import EllipsisVertical from "lucide-react-native/icons/ellipsis-vertical"
import GripVertical from "lucide-react-native/icons/grip-vertical"
import { useRef } from "react"
import { Pressable, View } from "react-native"
import Sortable from "react-native-sortables"
import { useProgress } from "react-native-track-player"
import { useActions, useCopies, useDeviceId, useItem } from "../store/hooks"
import { ItemMenu } from "./ItemMenu"
import { rowStatus } from "./RowStatus"
import { Thumb } from "./Thumb"
import { cn } from "./ui/cn"
import { Icon } from "./ui/Icon"
import { IconButton } from "./ui/IconButton"
import { Text } from "./ui/Text"

// One episode in the queue: grab the handle to move it, tap it to play it,
// hold it (or ⋮) for everything else. The one playing is tinted, and only it
// listens to the player's clock.
export function QueueRow({ id, current, playsNext, online }) {
	const row = useItem(id)
	const copies = useCopies(id)
	const deviceId = useDeviceId()
	const { playNow } = useActions()
	const menu = useRef(null)
	const status = rowStatus({ row, copies, deviceId, online })
	// `?? ""`: a removed row can render once more while it animates out.
	const title =
		row.title || (row.error ? "Couldn’t fetch this link" : (row.url ?? "").replace(/^https?:\/\/(www\.)?/, ""))
	return (
		<View
			className={cn(
				"mx-auto w-full max-w-page flex-row items-center gap-3xs pr-2xs pl-3xs web:hover:bg-surface-container-low",
				current && "bg-primary-wash web:hover:bg-primary-wash"
			)}
		>
			<Sortable.Handle>
				<View
					className="h-tap w-handle items-center justify-center web:cursor-grab"
					accessibilityLabel="Drag to reorder"
				>
					<Icon as={GripVertical} className="h-icon w-icon text-outline" />
				</View>
			</Sortable.Handle>
			<Pressable
				onPress={() => playNow(id)}
				onLongPress={() => menu.current?.open()}
				delayLongPress={400}
				accessibilityLabel={row.title || "Queued link"}
				className="flex-1 flex-row items-center gap-sm rounded-md py-xs pl-3xs active:bg-surface-container"
			>
				{current ? (
					<LiveThumb uri={row.thumbnail} duration={row.duration} />
				) : (
					<Thumb uri={row.thumbnail} duration={row.duration} />
				)}
				<View className="flex-1 gap-3xs">
					<Text
						variant="line"
						numberOfLines={2}
						className={cn(current && "font-body-semibold text-primary", !row.title && "text-on-surface-variant")}
					>
						{title}
					</Text>
					<View className="flex-row items-center gap-3xs">
						{status?.saved ? <Icon as={ArrowDownToLine} className="h-icon-sm w-icon-sm text-primary" /> : null}
						<Text variant="data" numberOfLines={1} className="flex-shrink">
							{row.channel}
							{row.channel && status?.text ? " · " : ""}
							{status?.text ? (
								<Text className={status.tone === "error" ? "text-error" : undefined}>{status.text}</Text>
							) : null}
						</Text>
					</View>
				</View>
			</Pressable>
			<ItemMenu
				itemId={id}
				where="queue"
				playsNext={playsNext}
				triggerRef={menu}
				trigger={<IconButton as={EllipsisVertical} size="sm" label="More" iconClassName="text-on-surface-variant" />}
			/>
		</View>
	)
}

function LiveThumb({ uri, duration }) {
	const { position, duration: playing } = useProgress(1000)
	const total = playing || duration || 0
	return <Thumb uri={uri} duration={duration} fraction={total > 0 ? position / total : 0} />
}
