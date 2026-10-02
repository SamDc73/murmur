import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing"

// Queue order is a fractional index on each row, so "move to top" or a drag
// touches one row and merges cleanly when two devices reorder at once.
// Nothing here knows about the store; it takes and returns plain rows.

export function keyAfter(lastKey) {
	return generateKeyBetween(lastKey || null, null)
}

export function keyBefore(firstKey) {
	return generateKeyBetween(null, firstKey || null)
}

export function keysAfter(lastKey, count) {
	return generateNKeysBetween(lastKey || null, null, count)
}

/** Rows of `items` as [id, row] pairs, the queue only, in play order. */
export function queueOf(itemsTable) {
	return Object.entries(itemsTable)
		.filter(([, row]) => !row.doneAt)
		.sort(([, a], [, b]) => byOrder(a, b))
}

function byOrder(a, b) {
	if (a.order < b.order) return -1
	if (a.order > b.order) return 1
	return a.addedAt - b.addedAt
}

/** History: played rows, most recent first. */
export function historyOf(itemsTable) {
	return Object.entries(itemsTable)
		.filter(([, row]) => row.doneAt)
		.sort(([, a], [, b]) => b.doneAt - a.doneAt)
}

export function lastKey(queue) {
	return queue.length === 0 ? null : queue[queue.length - 1][1].order
}

export function firstKey(queue) {
	return queue.length === 0 ? null : queue[0][1].order
}

/**
 * The key a row takes when dropped at `toIndex` of the queue it is currently
 * in at `fromIndex` (react-native-sortables semantics: indexes are of the
 * list before the move). Returns null when nothing changes.
 */
export function keyForMove(queue, fromIndex, toIndex) {
	if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= queue.length) return null
	const without = queue.filter((_, index) => index !== fromIndex)
	const before = toIndex > 0 ? (without[toIndex - 1]?.[1].order ?? null) : null
	const after = toIndex < without.length ? (without[toIndex]?.[1].order ?? null) : null
	return generateKeyBetween(before, after)
}

/**
 * The key that puts `movingId` right after `afterId` — "play next" behind the
 * episode that is playing. Without a (queued) `afterId`, it goes to the top.
 */
export function keyToFollow(queue, afterId, movingId) {
	const others = queue.filter(([id]) => id !== movingId)
	const at = others.findIndex(([id]) => id === afterId)
	if (at === -1) return generateKeyBetween(null, others[0]?.[1].order ?? null)
	return generateKeyBetween(others[at][1].order, others[at + 1]?.[1].order ?? null)
}

/**
 * What plays after `currentId`: the episode below it, like a playlist. Past
 * the last one there is nothing — the queue stops, it never wraps. With
 * nothing current, it is the top.
 */
export function nextUp(queue, currentId) {
	const at = queue.findIndex(([id]) => id === currentId)
	return queue[at + 1]?.[0] ?? ""
}

/** The episode above `currentId`, or "" at the top. */
export function previousOf(queue, currentId) {
	const at = queue.findIndex(([id]) => id === currentId)
	return at > 0 ? queue[at - 1][0] : ""
}

export function totalSeconds(rows) {
	let total = 0
	for (const row of rows) total += Number(row.duration) || 0
	return total
}

/** Seconds of listening left: the rest of the current item plus everything after it. */
export function remainingSeconds(queue, currentId) {
	const start = Math.max(
		0,
		queue.findIndex(([id]) => id === currentId)
	)
	let total = 0
	for (let index = start; index < queue.length; index++) {
		const row = queue[index][1]
		const duration = Number(row.duration) || 0
		total += index === start && queue[index][0] === currentId ? Math.max(0, duration - (row.position || 0)) : duration
	}
	return total
}
