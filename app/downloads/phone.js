import { COPY_STATE, copyId, TABLES } from "@murmur/core"
import { addNetworkStateListener } from "expo-network"
import { LOCAL_KEYS, localSetting } from "../store/local"
import { deleteLocalFile, runDownloads } from "./runner"

// The foreground half of downloading: watch the store, start the runner when
// something new is worth fetching, and delete files whose rows are gone or
// whose episode was played. Attached once per runtime, like the player bridge.

export const CAN_DOWNLOAD = true

let attached = false
let timer = null

export function attachDownloads(stores) {
	if (attached) return
	attached = true
	const { store, local } = stores
	const deviceId = () => local.getValue(LOCAL_KEYS.deviceId)

	// Remember the file behind each of our copy rows, so a vanished row can
	// still be turned into a deleted file.
	const uris = new Map()
	const remember = () => {
		for (const [cid, copy] of Object.entries(store.getTable(TABLES.copies))) {
			if (copy.deviceId === deviceId() && copy.uri) uris.set(cid, copy.uri)
		}
	}
	remember()

	function schedule() {
		if (timer !== null) return
		timer = setTimeout(() => {
			timer = null
			runDownloads(stores).catch((error) => console.warn("[downloads] failed", error))
		}, 400)
	}

	store.addRowIdsListener(TABLES.copies, () => {
		const present = new Set(store.getRowIds(TABLES.copies))
		for (const [cid, uri] of uris) {
			if (present.has(cid)) continue
			uris.delete(cid)
			deleteLocalFile(uri)
		}
		remember()
	})
	store.addTableListener(TABLES.copies, () => {
		remember()
		schedule()
	})
	store.addTableListener(TABLES.items, schedule)
	store.addValuesListener(schedule)
	local.addValuesListener(schedule)
	// Back on Wi‑Fi (or online at all): try again — "Only on Wi‑Fi" may have
	// said no when the episode was queued.
	addNetworkStateListener(schedule)

	// Played → free the space (unless told to keep). A mutator listener (the
	// trailing `true`) is the one kind allowed to write to the store.
	store.addCellListener(
		TABLES.items,
		null,
		"doneAt",
		(_store, _table, itemId, _cell, doneAt) => {
			if (!doneAt || !localSetting(local.getValues(), LOCAL_KEYS.deleteAfterPlay)) return
			const cid = copyId(itemId, deviceId())
			if (store.getCell(TABLES.copies, cid, "state") === COPY_STATE.ready) store.delRow(TABLES.copies, cid)
		},
		true
	)

	schedule()
}
