import { dayLabel, hours, timeOfDay, totalSeconds } from "@murmur/core"
import EllipsisVertical from "lucide-react-native/icons/ellipsis-vertical"
import ListPlus from "lucide-react-native/icons/list-plus"
import { memo, useMemo } from "react"
import { Pressable, ScrollView, View } from "react-native"
import { EmptyState } from "../../components/EmptyState"
import { ItemMenu } from "../../components/ItemMenu"
import { NoteLine } from "../../components/NoteLine"
import { ScreenHeader } from "../../components/ScreenHeader"
import { Thumb } from "../../components/Thumb"
import { cn } from "../../components/ui/cn"
import { COLUMN } from "../../components/ui/column"
import { IconButton } from "../../components/ui/IconButton"
import { Text } from "../../components/ui/Text"
import { useActions, useHistory, useItem } from "../../store/hooks"

// What has been heard, newest first, a day at a time. Tap to hear it again;
// + puts it back at the end of the queue. A plain scroll of every day, like
// the queue — history is finite, so it needs no virtualizing.
export default function HistoryScreen() {
	const history = useHistory()
	const days = useMemo(() => {
		const byDay = new Map()
		for (const [id, row] of history) {
			const label = dayLabel(row.doneAt)
			if (!byDay.has(label)) byDay.set(label, [])
			byDay.get(label).push(id)
		}
		return [...byDay.entries()]
	}, [history])

	const lede =
		history.length === 0
			? "Nothing played yet"
			: `${history.length} played · ${hours(totalSeconds(history.map(([, row]) => row)))}`

	return (
		<View className="flex-1 bg-background">
			<ScreenHeader title="History" lede={lede} />
			{history.length === 0 ? (
				<EmptyState
					title="Nothing played yet"
					body="Finished episodes land here, and can go back to the queue any time."
				/>
			) : (
				<ScrollView contentContainerClassName="pb-lg">
					{days.map(([title, ids], day) => (
						// A day's eyebrow sits md under the header, like Settings' first
						// group; the days stand lg apart, like its groups.
						<View key={title} className={cn(day > 0 && "pt-lg")}>
							<View className={cn(COLUMN, "pb-xs")}>
								<Text variant="eyebrow">{title}</Text>
							</View>
							{ids.map((id) => (
								<HistoryRow key={id} id={id} />
							))}
						</View>
					))}
				</ScrollView>
			)}
		</View>
	)
}

// Memoized on its id and reading its own row: the list recomputes while
// something plays (positions are saved every few seconds); the rows don't.
const HistoryRow = memo(function HistoryRow({ id }) {
	const row = useItem(id)
	const { playAgain, requeue } = useActions()
	const at = row.doneAt ? timeOfDay(row.doneAt) : ""
	return (
		// As a queue row: the thumbnail on the column's edge, ⋮ hanging in the margin.
		<Pressable
			onPress={() => playAgain(id)}
			accessibilityLabel={row.title || row.url}
			className="mx-auto w-full max-w-page flex-row pl-lg active:opacity-80 web:rounded-sm web:hover:bg-surface-container-low"
		>
			<View className="flex-1 flex-row items-center gap-md py-xs">
				<Thumb uri={row.thumbnail} duration={row.duration} />
				<View className="flex-1 gap-3xs">
					<Text variant="line" numberOfLines={2}>
						{row.title || row.url}
					</Text>
					<Text variant="data" numberOfLines={1}>
						{[row.channel, at].filter(Boolean).join(" · ")}
					</Text>
					<NoteLine note={row.note} />
				</View>
				<IconButton
					as={ListPlus}
					size="sm"
					label="Add to queue"
					onPress={() => requeue(id)}
					iconClassName="text-on-surface-variant"
				/>
			</View>
			<ItemMenu
				itemId={id}
				where="history"
				trigger={
					// Centred in the row at its own size, not h-full: a percentage height
					// resolves against the scroll viewport, not the row, and stretched the
					// ⋮ — and so the row — to fill the screen.
					<IconButton
						as={EllipsisVertical}
						size="sm"
						label="More"
						className="w-lg self-center"
						iconClassName="text-on-surface-variant"
					/>
				}
			/>
		</Pressable>
	)
})
