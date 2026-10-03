import { classifyLinks, extractLinks } from "./links.js"
import { keyAfter, keyForMove, keysAfter, keyToFollow, lastKey, nextUp, previousOf, queueOf } from "./queue.js"
import { COPY_STATE, copyId, DEVICE_SERVER, newItem, setting, TABLES, VALUES } from "./schema.js"

// Every change to the queue, on any store: the app's buttons and the server's
// API call the same functions, so a link added either way behaves the same.
// `newId` makes row ids (each runtime has its own way).
export function queueActions(store, { newId }) {
	const items = () => store.getTable(TABLES.items)
	const queue = () => queueOf(items())
	const currentId = () => setting(store.getValues(), VALUES.currentItemId)

	// If the current episode is leaving the queue, the pointer moves to the one
	// below it first (or to nothing, at the end).
	function pointPastCurrent(id) {
		if (currentId() === id) store.setValue(VALUES.currentItemId, nextUp(queue(), id))
	}

	/**
	 * Look before adding: every link in `text` (YouTube videos, playlists,
	 * Google Docs), sorted into fresh / queued / played. Writes nothing.
	 */
	function planAdd(text) {
		const links = extractLinks(text)
		return { links, ...classifyLinks(links, items()) }
	}

	/**
	 * Add what `planAdd` found. Fresh links join the end of the queue;
	 * `requeuePlayed` brings played ones back after them; `queuedNext`
	 * moves already-queued ones up to play next.
	 */
	function addPlanned(plan, { requeuePlayed = false, queuedNext = false } = {}) {
		const now = Date.now()
		const again = requeuePlayed ? plan.played : []
		const keys = keysAfter(lastKey(queue()), plan.fresh.length + again.length)
		const added = []
		store.transaction(() => {
			plan.fresh.forEach((link, index) => {
				const id = newId()
				const row = newItem({ url: link.url, videoId: link.videoId, order: keys[index], addedAt: now + index })
				store.setRow(TABLES.items, id, { ...row, position: link.start })
				added.push(id)
			})
			again.forEach(({ id }, index) => {
				store.setPartialRow(TABLES.items, id, { doneAt: 0, position: 0, order: keys[plan.fresh.length + index] })
			})
			if (queuedNext) {
				let after = currentId()
				for (const { id } of plan.queued) {
					if (id !== currentId()) store.setCell(TABLES.items, id, "order", keyToFollow(queue(), after, id))
					after = id
				}
			}
		})
		return { added, requeued: again.map(({ id }) => id), moved: queuedNext ? plan.queued.map(({ id }) => id) : [] }
	}

	/** Add everything in `text` at once; something played before comes back. */
	function addText(text) {
		return addPlanned(planAdd(text), { requeuePlayed: true })
	}

	/** Gone everywhere: the row, every device's copy, and (on the server) the files. */
	function remove(id) {
		store.transaction(() => {
			pointPastCurrent(id)
			store.delRow(TABLES.items, id)
			for (const cid of store.getRowIds(TABLES.copies)) {
				if (store.getCell(TABLES.copies, cid, "itemId") === id) store.delRow(TABLES.copies, cid)
			}
		})
	}

	/** Right below whatever is playing now (the top, if nothing is). */
	function playNext(id) {
		const current = queue()
		const playing = currentId()
		if (id === playing || nextUp(current, playing) === id) return
		store.setCell(TABLES.items, id, "order", keyToFollow(current, playing, id))
	}

	/** The row at `fromIndex` now sits at `toIndex` (a drag, or the API's `index`). */
	function move(fromIndex, toIndex) {
		const current = queue()
		const key = keyForMove(current, fromIndex, toIndex)
		if (key !== null) store.setCell(TABLES.items, current[fromIndex][0], "order", key)
	}

	function markDone(id) {
		store.transaction(() => {
			store.setCell(TABLES.items, id, "doneAt", Date.now())
			pointPastCurrent(id)
		})
	}

	/**
	 * Back from History: to the end of the queue, `next` (right below what is
	 * playing), or `now` (just above it, so it picks up again afterwards).
	 */
	function requeue(id, { where = "end" } = {}) {
		const current = queue()
		const order = {
			end: () => keyAfter(lastKey(current)),
			next: () => keyToFollow(current, currentId(), id),
			now: () => keyToFollow(current, previousOf(current, currentId()), id),
		}[where]()
		store.setPartialRow(TABLES.items, id, { doneAt: 0, position: 0, order })
	}

	/** Clear a failure so the server tries the link again. */
	function retry(id) {
		store.transaction(() => {
			store.setPartialRow(TABLES.items, id, { error: "", resolvedAt: 0 })
			const cid = copyId(id, DEVICE_SERVER)
			if (store.getCell(TABLES.copies, cid, "state") === COPY_STATE.error) store.delRow(TABLES.copies, cid)
		})
	}

	/** Ask the server for this item as video (or back to audio). */
	function wantKind(id, kind) {
		store.setCell(TABLES.items, id, "wantKind", kind)
	}

	return { planAdd, addPlanned, addText, remove, playNext, move, markDone, requeue, retry, wantKind }
}
