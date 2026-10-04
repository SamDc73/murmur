import { COPY_STATE, copyId, DEVICE_SERVER, queueOf, TABLES } from "@murmur/core"
import { Paths } from "expo-file-system"
import * as FileSystem from "expo-file-system/legacy"
import * as Network from "expo-network"
import { LOCAL_KEYS, localSetting, mediaUrl } from "../store/local"

// Pulling the server's copies onto this phone. Plain async functions with no
// React in them, because the background task runs them too.

const PROGRESS_EVERY_MS = 700

function mediaDirUri() {
	return `${Paths.document.uri.replace(/\/?$/, "/")}murmur/`
}

function extensionOf(uri) {
	const match = /\.([a-z0-9]{2,5})$/i.exec(uri ?? "")
	return match ? match[1].toLowerCase() : "m4a"
}

/**
 * Items this phone should have but does not, in play order. A copy of the
 * other kind counts as missing: after "Get the video" (or "Audio only") the
 * phone swaps its file for the server's new one.
 */
function pendingDownloads({ store, local }) {
	const deviceId = local.getValue(LOCAL_KEYS.deviceId)
	const auto = localSetting(local.getValues(), LOCAL_KEYS.autoDownload)
	const copies = store.getTable(TABLES.copies)
	const wanted = []
	for (const [id] of queueOf(store.getTable(TABLES.items))) {
		const server = copies[copyId(id, DEVICE_SERVER)]
		if (!server || server.state !== COPY_STATE.ready) continue
		const mine = copies[copyId(id, deviceId)]
		const stale = mine?.state === COPY_STATE.ready && mine.kind !== server.kind
		if (mine?.state === COPY_STATE.downloading || mine?.state === COPY_STATE.error) continue
		if (mine?.state === COPY_STATE.ready && !stale) continue
		if (stale || mine?.state === COPY_STATE.pending || auto) wanted.push({ id, server })
	}
	return wanted
}

async function networkAllows(local) {
	if (!localSetting(local.getValues(), LOCAL_KEYS.wifiOnly)) return true
	try {
		const state = await Network.getNetworkStateAsync()
		return state.type === Network.NetworkStateType.WIFI || state.type === Network.NetworkStateType.ETHERNET
	} catch {
		return true
	}
}

let running = null

/**
 * Download everything pending, one at a time, within `budgetMs`. Calls while
 * a run is going join it. The reset hangs off the promise (`.finally`), so it
 * always lands after the assignment — even when there is nothing to do and
 * the run ends without ever waiting.
 */
export function runDownloads(stores, options) {
	running ??= downloadPending(stores, options).finally(() => {
		running = null
	})
	return running
}

async function downloadPending(stores, { budgetMs = Number.POSITIVE_INFINITY } = {}) {
	const started = Date.now()
	for (;;) {
		const [nextItem] = pendingDownloads(stores)
		if (!nextItem || Date.now() - started > budgetMs) return
		if (!(await networkAllows(stores.local))) return
		await downloadOne(stores, nextItem)
	}
}

async function downloadOne({ store, local }, { id, server }) {
	const deviceId = local.getValue(LOCAL_KEYS.deviceId)
	const serverUrl = local.getValue(LOCAL_KEYS.serverUrl)
	const token = local.getValue(LOCAL_KEYS.token)
	if (!serverUrl) return
	const cid = copyId(id, deviceId)
	// Swapping kinds: the old file goes first, and the player streams meanwhile.
	await deleteLocalFile(store.getCell(TABLES.copies, cid, "uri"))
	const dir = mediaDirUri()
	await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined)
	const dest = `${dir}${id}.${extensionOf(server.uri)}`
	store.setRow(TABLES.copies, cid, {
		itemId: id,
		deviceId,
		kind: server.kind,
		state: COPY_STATE.downloading,
		progress: 0,
		bytes: 0,
		uri: "",
		error: "",
		updatedAt: Date.now(),
	})
	let lastAt = 0
	const resumable = FileSystem.createDownloadResumable(
		mediaUrl(serverUrl, token, server.uri, server.updatedAt),
		dest,
		{},
		({ totalBytesWritten, totalBytesExpectedToWrite }) => {
			const now = Date.now()
			if (now - lastAt < PROGRESS_EVERY_MS) return
			lastAt = now
			store.setPartialRow(TABLES.copies, cid, {
				progress: totalBytesExpectedToWrite > 0 ? Math.min(1, totalBytesWritten / totalBytesExpectedToWrite) : 0,
				bytes: totalBytesWritten,
				updatedAt: now,
			})
		}
	)
	try {
		const result = await resumable.downloadAsync()
		if (!result || result.status >= 400) throw new Error(`server said ${result?.status ?? "nothing"}`)
		const info = await FileSystem.getInfoAsync(result.uri, { size: true })
		store.setPartialRow(TABLES.copies, cid, {
			state: COPY_STATE.ready,
			progress: 1,
			bytes: info.size ?? 0,
			uri: result.uri,
			error: "",
			updatedAt: Date.now(),
		})
	} catch (error) {
		await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => undefined)
		store.setPartialRow(TABLES.copies, cid, {
			state: COPY_STATE.error,
			error: String(error.message ?? error).slice(0, 200),
			updatedAt: Date.now(),
		})
	}
}

export async function deleteLocalFile(uri) {
	if (!uri) return
	await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)
}
