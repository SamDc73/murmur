import { dayLabel, hours, timeOfDay, totalSeconds } from "@murmur/core"
import EllipsisVertical from "lucide-react-native/icons/ellipsis-vertical"
import ListPlus from "lucide-react-native/icons/list-plus"
import { memo, useMemo } from "react"
import { Pressable, SectionList, View } from "react-native"
import { EmptyState } from "../../components/EmptyState"
import { ItemMenu } from "../../components/ItemMenu"
import { NoteLine } from "../../components/NoteLine"
import { ScreenHeader } from "../../components/ScreenHeader"
import { Thumb } from "../../components/Thumb"
import { IconButton } from "../../components/ui/IconButton"
import { Text } from "../../components/ui/Text"
import { useActions, useHistory, useItem } from "../../store/hooks"

// What has been heard, newest first, a day at a time. Tap to hear it again;
// + puts it back at the end of the queue.
export default function HistoryScreen() {
	const history = useHistory()
	const sections = useMemo(() => {
		const byDay = new Map()
		for (const [id, row] of history) {
			const label = dayLabel(row.doneAt)
			if (!byDay.has(label)) byDay.set(label, [])
			byDay.get(label).push(id)
		}
		return [...byDay.entries()].map(([title, data]) => ({ title, data }))
	}, [history])

	const lede =
		history.length === 0
			? "Nothing played yet"
			: `${history.length} played · ${hours(totalSeconds(history.map(([, row]) => row)))}`

	return (
		<View className="flex-1 bg-background">
			<ScreenHeader title="History" lede={lede} />
			<SectionList
				sections={sections}
				keyExtractor={keyOf}
				stickySectionHeadersEnabled={false}
				contentContainerStyle={{ paddingBottom: 24 }}
				ListEmptyComponent={
					<EmptyState
						title="Nothing played yet"
						body="Finished episodes land here, and can go back to the queue any time."
					/>
				}
				renderSectionHeader={renderDay}
				renderItem={renderRow}
			/>
		</View>
	)
}

const keyOf = (id) => id
const renderDay = ({ section }) => (
	<View className="mx-auto w-full max-w-page px-md pt-md pb-2xs">
		<Text variant="eyebrow">{section.title}</Text>
	</View>
)
const renderRow = ({ item: id }) => <HistoryRow id={id} />

// Memoized on its id and reading its own row: the list recomputes while
// something plays (positions are saved every few seconds); the rows don't.
const HistoryRow = memo(function HistoryRow({ id }) {
	const row = useItem(id)
	const { playAgain, requeue } = useActions()
	const at = row.doneAt ? timeOfDay(row.doneAt) : ""
	return (
		<Pressable
			onPress={() => playAgain(id)}
			accessibilityLabel={row.title || row.url}
			className="mx-auto w-full max-w-page flex-row items-center gap-sm py-xs pr-2xs pl-md active:bg-surface-container web:hover:bg-surface-container-low"
		>
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
			<ItemMenu
				itemId={id}
				where="history"
				trigger={<IconButton as={EllipsisVertical} size="sm" label="More" iconClassName="text-on-surface-variant" />}
			/>
		</Pressable>
	)
})
