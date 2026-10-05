import { clock } from "@murmur/core"
import { memo, useCallback } from "react"
import { FlatList, Pressable } from "react-native"
import { usePosition } from "../../player/picture"
import { cn } from "../ui/cn"
import { Text } from "../ui/Text"

// The episode's chapters, as a table of contents: tap one to go there. The
// one playing is marked.
export function Chapters({ chapters, onSeek }) {
	const { position } = usePosition(250)
	let active = -1
	for (let index = 0; index < chapters.length; index++) if (chapters[index].start <= position) active = index
	const renderItem = useCallback(
		({ item, index }) => <Line start={item.start} text={item.title} active={index === active} onSeek={onSeek} />,
		[active, onSeek]
	)
	return <FlatList data={chapters} keyExtractor={keyOf} renderItem={renderItem} extraData={active} />
}

const keyOf = (chapter, index) => `${index}:${chapter.start}`

// A time and a line of text; shared with the transcript. Its wash's corner
// is its inset over φ (sm → xs).
export const Line = memo(function Line({ start, text, active, onSeek }) {
	return (
		<Pressable
			onPress={() => onSeek(start)}
			className={cn(
				"flex-row items-baseline gap-md rounded-xs px-sm py-xs active:bg-surface-container web:hover:bg-surface-container",
				active && "bg-primary-wash web:hover:bg-primary-wash"
			)}
		>
			<Text variant="mono" className={active ? "text-primary" : "text-on-surface-variant"}>
				{clock(start)}
			</Text>
			<Text variant="line" className={cn("flex-1", active && "text-primary")}>
				{text}
			</Text>
		</Pressable>
	)
})
