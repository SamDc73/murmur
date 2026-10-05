import { cueIndexAt } from "@murmur/core"
import { useCallback, useEffect, useRef } from "react"
import { FlatList, View } from "react-native"
import { usePosition } from "../../player/picture"
import { useTranscript } from "../../store/server"
import { Text } from "../ui/Text"
import { Line } from "./Chapters"

// The transcript, as YouTube shows it: every line with its time, the one
// being spoken marked, and the list following along. Scroll it yourself and
// it stops following (the tab bar then offers "Follow"); tap a line to jump
// there and it follows again.
export function Transcript({ itemId, lang, following, onFollowingChange, onSeek }) {
	const { data: cues, isPending, isError } = useTranscript(itemId, lang)
	const { position } = usePosition(250)
	const list = useRef(null)
	const active = cues ? cueIndexAt(cues, position) : -1
	// The line the list keeps in view: the spoken one, while following.
	const followed = following ? active : -1

	// Keep it in view — a side effect on the native list, not state. (Following
	// playback is what effects are for; there is no event to move this into.)
	useEffect(() => {
		// eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- syncs a native list's scroll to playback
		if (followed >= 0) list.current?.scrollToIndex({ index: followed, viewPosition: 0.3, animated: true })
	}, [followed])

	// A line not yet laid out: jump near it by the average height, then exactly.
	const scrollToUnmeasured = useCallback(({ index, averageItemLength }) => {
		list.current?.scrollToOffset({ offset: averageItemLength * index, animated: false })
		requestAnimationFrame(() => list.current?.scrollToIndex({ index, viewPosition: 0.3, animated: false }))
	}, [])
	const stopFollowing = useCallback(() => onFollowingChange(false), [onFollowingChange])
	const seek = useCallback(
		(start) => {
			onFollowingChange(true)
			onSeek(start)
		},
		[onFollowingChange, onSeek]
	)
	const renderItem = useCallback(
		({ item, index }) => <Line start={item.s} text={item.t} active={index === active} onSeek={seek} />,
		[active, seek]
	)

	if (isPending) return <Note text="Loading the transcript…" />
	if (isError || !cues?.length) return <Note text="The transcript isn’t available." />
	return (
		<FlatList
			ref={list}
			data={cues}
			keyExtractor={keyOf}
			renderItem={renderItem}
			extraData={active}
			// The listener taking over: a finger dragging the list on a phone, a
			// wheel or a touch in a browser. The list's own following never fires these.
			onScrollBeginDrag={stopFollowing}
			onWheel={stopFollowing}
			onTouchMove={stopFollowing}
			onScrollToIndexFailed={scrollToUnmeasured}
		/>
	)
}

const keyOf = (cue, index) => `${index}:${cue.s}`

// Set where the first line would start.
function Note({ text }) {
	return (
		<View className="px-sm py-xs">
			<Text variant="label" className="text-on-surface-variant">
				{text}
			</Text>
		</View>
	)
}
