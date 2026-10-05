import ArrowDownToLine from "lucide-react-native/icons/arrow-down-to-line"
import EllipsisVertical from "lucide-react-native/icons/ellipsis-vertical"
import GripVertical from "lucide-react-native/icons/grip-vertical"
import { useRef } from "react"
import { Pressable, View } from "react-native"
import Sortable from "react-native-sortables"
import { useProgress } from "react-native-track-player"
import { useActions, useCopies, useDeviceId, useItem } from "../store/hooks"
import { ItemMenu } from "./ItemMenu"
import { NoteLine } from "./NoteLine"
import { rowStatus } from "./RowStatus"
import { Thumb } from "./Thumb"
import { cn } from "./ui/cn"
import { Icon } from "./ui/Icon"
import { IconButton } from "./ui/IconButton"
import { Text } from "./ui/Text"

// One episode in the queue: grab the handle to move it, tap it to play it,
// hold it (or ⋮) for everything else. The one playing is tinted, and only it
// listens to the player's clock.
//
// The row spans the column with its margins: the grip and the ⋮ hang in them,
// so the thumbnail sits on the column's edge — under the screen's title and
// the add bar — and the tint runs into the margins. A thumbnail's corner (2xs)
// plus the row's padding (xs) is the row's own corner (sm), where it shows.
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
				"mx-auto w-full max-w-page flex-row web:rounded-sm web:hover:bg-surface-container-low",
				current && "bg-primary-wash web:hover:bg-primary-wash"
			)}
		>
			<Sortable.Handle>
				<View className="h-full w-lg items-center justify-center web:cursor-grab" accessibilityLabel="Drag to reorder">
					<Icon as={GripVertical} className="h-icon w-icon text-outline" />
				</View>
			</Sortable.Handle>
			<Pressable
				onPress={() => playNow(id)}
				onLongPress={() => menu.current?.open()}
				delayLongPress={400}
				accessibilityLabel={row.title || "Queued link"}
				className="flex-1 flex-row items-center gap-md py-xs active:opacity-80"
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
					<NoteLine note={row.note} />
				</View>
			</Pressable>
			<ItemMenu
				itemId={id}
				where="queue"
				playsNext={playsNext}
				triggerRef={menu}
				trigger={
					<IconButton
						as={EllipsisVertical}
						size="sm"
						label="More"
						className="h-full w-lg"
						iconClassName="text-on-surface-variant"
					/>
				}
			/>
		</View>
	)
}

function LiveThumb({ uri, duration }) {
	const { position, duration: playing } = useProgress(1000)
	const total = playing || duration || 0
	return <Thumb uri={uri} duration={duration} fraction={total > 0 ? position / total : 0} />
}
