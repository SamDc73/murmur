import {
	COPY_STATE,
	classifyLinks,
	copiesByItem,
	copyId,
	DEVICE_SERVER,
	extractYouTubeLinks,
	historyOf,
	keyAfter,
	keyForMove,
	keysAfter,
	keyToFollow,
	lastKey,
	newCopy,
	newItem,
	nextUp,
	previousOf,
	queueOf,
	setting,
	TABLES,
	VALUES,
} from "@murmur/core"
import { useMemo } from "react"
import { useRow, useStore, useTable, useValue } from "tinybase/ui-react"
import { newId } from "../lib/id"
import { requestPlay } from "../player/controller"
import { LOCAL, LOCAL_KEYS, localSetting } from "./local"

// Every read and every write the screens do. Reads are hooks; writes are
// plain functions on the store, handed out by useActions(). Components never
// touch the store directly, so the schema has two homes: core, and here.

// ---- reads ------------------------------------------------------------------

export function useQueue() {
	const items = useTable(TABLES.items)
	return useMemo(() => queueOf(items), [items])
}

export function useHistory() {
	const items = useTable(TABLES.items)
	return useMemo(() => historyOf(items), [items])
}

export function useItem(id) {
	return useRow(TABLES.items, id ?? "")
}

/** itemId → { deviceId → copy }, for every item at once. */
export function useCopiesByItem() {
	const copies = useTable(TABLES.copies)
	return useMemo(() => copiesByItem(copies), [copies])
}

/**
 * { deviceId → copy } for one item: the two copies anything reads — the
 * server's and this device's — each its own subscription, so a download
 * moving elsewhere re-renders nothing here.
 */
export function useCopies(itemId) {
	const deviceId = useDeviceId()
	const server = useRow(TABLES.copies, copyId(itemId ?? "", DEVICE_SERVER))
	const mine = useRow(TABLES.copies, copyId(itemId ?? "", deviceId))
	return useMemo(() => ({ [DEVICE_SERVER]: server, [deviceId]: mine }), [server, mine, deviceId])
}

export function useSetting(key) {
	const value = useValue(key)
	return setting({ [key]: value }, key)
}

/** Every device that has ever synced: id → { name, kind, lastSeen }. */
export function useDevices() {
	return useTable(TABLES.devices)
}

export function useCurrentId() {
	return useSetting(VALUES.currentItemId)
}

export function useLocal(key) {
	const value = useValue(key, LOCAL)
	return localSetting({ [key]: value }, key)
}

export function useDeviceId() {
	return useValue(LOCAL_KEYS.deviceId, LOCAL) ?? ""
}

// ---- writes -----------------------------------------------------------------

export function useActions() {
	const store = useStore()
	const local = useStore(LOCAL)
	return useMemo(() => actionsFor(store, local), [store, local])
}

function actionsFor(store, local) {
	const items = () => store.getTable(TABLES.items)
	const queue = () => queueOf(items())
	const currentId = () => setting(store.getValues(), VALUES.currentItemId)
	const deviceId = () => local.getValue(LOCAL_KEYS.deviceId)

	// If the current episode is leaving the queue, the pointer moves to the one
	// below it first (or to nothing, at the end).
	function pointPastCurrent(id) {
		if (currentId() === id) store.setValue(VALUES.currentItemId, nextUp(queue(), id))
	}

	/**
	 * Look before adding: every YouTube link in `text`, sorted into
	 * fresh / queued / played against what is already here. Writes nothing.
	 */
	function planAdd(text) {
		const links = extractYouTubeLinks(text)
		return { links, ...classifyLinks(links, items()) }
	}

	/**
	 * Add what `planAdd` found. Fresh links join the end of the queue;
	 * `requeuePlayed` brings played ones back after them; `queuedNext`
	 * moves already-queued ones up to play next.
	 */
	function addPlanned(plan, { requeuePlayed = false, queuedNext = false } = {}) {
		const current = queue()
		const now = Date.now()
		const fresh = plan.fresh
		const again = requeuePlayed ? plan.played : []
		const keys = keysAfter(lastKey(current), fresh.length + again.length)
		store.transaction(() => {
			fresh.forEach((link, index) => {
				const row = newItem({ url: link.url, videoId: link.videoId, order: keys[index], addedAt: now + index })
				store.setRow(TABLES.items, newId(), { ...row, position: link.start })
			})
			again.forEach(({ id }, index) => {
				store.setPartialRow(TABLES.items, id, { doneAt: 0, position: 0, order: keys[fresh.length + index] })
			})
			if (queuedNext) {
				let after = currentId()
				for (const { id } of plan.queued) {
					if (id !== currentId()) store.setCell(TABLES.items, id, "order", keyToFollow(queue(), after, id))
					after = id
				}
			}
		})
		return { added: fresh.length, requeued: again.length, moved: queuedNext ? plan.queued.length : 0 }
	}

	/** Share to Murmur: add it all; something played before comes back. */
	function addLinks(text) {
		const plan = planAdd(text)
		return plan.links.length === 0 ? null : addPlanned(plan, { requeuePlayed: true })
	}

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

	/** A drag ended: the row at `fromIndex` now sits at `toIndex`. */
	function move(fromIndex, toIndex) {
		const current = queue()
		const key = keyForMove(current, fromIndex, toIndex)
		if (key !== null) store.setCell(TABLES.items, current[fromIndex][0], "order", key)
	}

	function playNow(id) {
		requestPlay(id)
	}

	function markDone(id) {
		store.transaction(() => {
			store.setCell(TABLES.items, id, "doneAt", Date.now())
			pointPastCurrent(id)
		})
	}

	/**
	 * From History, straight into the player — just above what was playing,
	 * so that one picks up again after it.
	 */
	function playAgain(id) {
		const current = queue()
		const above = previousOf(current, currentId())
		store.setPartialRow(TABLES.items, id, { doneAt: 0, position: 0, order: keyToFollow(current, above, id) })
		requestPlay(id)
	}

	/** Back from History: to the end of the queue, or `next` — right below what is playing. */
	function requeue(id, { next = false } = {}) {
		const current = queue()
		const order = next ? keyToFollow(current, currentId(), id) : keyAfter(lastKey(current))
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

	/** Fetch this item onto this phone now, whatever the auto-download rules say. */
	function downloadHere(id) {
		const kind = store.getCell(TABLES.copies, copyId(id, DEVICE_SERVER), "kind") || "audio"
		const copy = newCopy({ itemId: id, deviceId: deviceId(), kind, updatedAt: Date.now() })
		store.setRow(TABLES.copies, copyId(id, deviceId()), copy)
	}

	function removeHere(id) {
		store.delRow(TABLES.copies, copyId(id, deviceId()))
	}

	/** A scanned or tapped pairing code: the server and its token, together. */
	function pair({ serverUrl, token }) {
		local.setPartialValues({ [LOCAL_KEYS.serverUrl]: serverUrl, [LOCAL_KEYS.token]: token })
	}

	/** Delete every file this phone holds (the rows go; the files follow). */
	function removeAllHere() {
		store.transaction(() => {
			for (const cid of store.getRowIds(TABLES.copies)) {
				if (store.getCell(TABLES.copies, cid, "deviceId") === deviceId()) store.delRow(TABLES.copies, cid)
			}
		})
	}

	/** What other devices call this one. */
	function renameDevice(name) {
		local.setValue(LOCAL_KEYS.deviceName, name)
		if (deviceId()) store.setCell(TABLES.devices, deviceId(), "name", name)
	}

	function setSetting(key, value) {
		store.setValue(key, value)
	}

	function setLocal(key, value) {
		local.setValue(key, value)
	}

	return {
		planAdd,
		addPlanned,
		addLinks,
		remove,
		playNext,
		move,
		playNow,
		markDone,
		playAgain,
		requeue,
		retry,
		wantKind,
		downloadHere,
		removeHere,
		pair,
		removeAllHere,
		renameDevice,
		setSetting,
		setLocal,
	}
}
