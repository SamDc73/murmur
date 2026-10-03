import {
	copiesByItem,
	copyId,
	DEVICE_SERVER,
	historyOf,
	newCopy,
	queueActions,
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
	// The queue's own changes are shared with the server's API (@murmur/core);
	// what's added here is this device's: playing, its files, its pairing.
	const queue = queueActions(store, { newId })
	const deviceId = () => local.getValue(LOCAL_KEYS.deviceId)

	function playNow(id) {
		requestPlay(id)
	}

	/** From History, straight into the player — just above what was playing. */
	function playAgain(id) {
		queue.requeue(id, { where: "now" })
		requestPlay(id)
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
		...queue,
		playNow,
		playAgain,
		downloadHere,
		removeHere,
		pair,
		removeAllHere,
		renameDevice,
		setSetting,
		setLocal,
	}
}
