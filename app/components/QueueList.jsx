import { nextUp } from "@murmur/core"
import { useCallback, useMemo } from "react"
import Animated, { useAnimatedRef } from "react-native-reanimated"
import Sortable from "react-native-sortables"
import { useActions, useCurrentId, useLocal } from "../store/hooks"
import { LOCAL_KEYS } from "../store/local"
import { QueueRow } from "./QueueRow"

// The queue: a one-column sortable list inside a scroll view, so a long drag
// scrolls it. Nothing sits above the rows inside the scroll view — anything
// that changed height there would move the rows under a finger mid-drag.
// Drag works on every screen — a finger on a phone, a mouse on a desktop —
// from the handle, at once. A drop rewrites one row's order key; the list
// re-sorts from the store, so the drag never owns the data.
export function QueueList({ queue, empty }) {
	const scrollableRef = useAnimatedRef()
	const { move } = useActions()
	const currentId = useCurrentId()
	const online = useLocal(LOCAL_KEYS.syncState) === "online"
	const nextId = nextUp(queue, currentId)
	// Ids, not rows: each row reads its own episode, so a position saved or a
	// download moving re-renders that one row, not the list.
	const ids = useMemo(() => queue.map(([id]) => id), [queue])

	const renderItem = useCallback(
		({ item: id }) => (
			<QueueRow id={id} current={id === currentId} playsNext={id === currentId || id === nextId} online={online} />
		),
		[currentId, nextId, online]
	)

	return (
		<Animated.ScrollView
			ref={scrollableRef}
			contentContainerStyle={{ paddingBottom: 24 }}
			keyboardShouldPersistTaps="handled"
		>
			{queue.length === 0 ? empty : null}
			<Sortable.Grid
				columns={1}
				data={ids}
				keyExtractor={keyOf}
				renderItem={renderItem}
				scrollableRef={scrollableRef}
				customHandle
				dragActivationDelay={0}
				activeItemScale={1.02}
				inactiveItemOpacity={0.9}
				hapticsEnabled
				onDragEnd={({ fromIndex, toIndex }) => move(fromIndex, toIndex)}
			/>
		</Animated.ScrollView>
	)
}

const keyOf = (id) => id
