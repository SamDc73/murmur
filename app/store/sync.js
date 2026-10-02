import { normaliseServerUrl } from "@murmur/core"
import { useEffect, useSyncExternalStore } from "react"
import { AppState, Platform } from "react-native"
import { createWsSynchronizer } from "tinybase/synchronizers/synchronizer-ws-client"
import { useStore, useValue } from "tinybase/ui-react"
import { LOCAL, LOCAL_KEYS, wsUrl } from "./local"

// Sync is one WebSocket to the server's hub, open while the app is on screen.
// Entering a server URL turns it on; clearing it turns it off. On a phone it
// closes when the app goes to the background — Android cuts background
// network anyway, and an idle socket costs battery — and reopens on return;
// playback carries on from the local store meanwhile. Its state lives in the
// local store so any screen can show it.

const BACKOFF_MS = [1000, 2000, 5000, 10000, 30000]

export function useSync() {
	const store = useStore()
	const local = useStore(LOCAL)
	const serverUrl = useValue(LOCAL_KEYS.serverUrl, LOCAL) ?? ""
	const token = useValue(LOCAL_KEYS.token, LOCAL) ?? ""
	const awake = useSyncExternalStore(onAppStateChange, isAwake)

	useEffect(() => {
		if (!serverUrl) {
			local.setValue(LOCAL_KEYS.syncState, "off")
			return
		}
		if (!awake) return
		return keepConnected({ store, local, serverUrl, token })
	}, [store, local, serverUrl, token, awake])
}

function onAppStateChange(callback) {
	const subscription = AppState.addEventListener("change", callback)
	return () => subscription.remove()
}

// A browser tab stays connected; a phone app only while it is not in the background.
const isAwake = () => Platform.OS === "web" || AppState.currentState !== "background"

/**
 * Stay synced until stopped: knock, open the socket, sync — and when it
 * drops, wait a little longer each time and go again. A wrong or missing
 * token is an answer, not an outage: it is reported once and not retried;
 * the effect starts over when the token changes. Returns the stop function.
 */
function keepConnected({ store, local, serverUrl, token }) {
	let stopped = false
	let drops = 0
	let retry = null
	let socket = null
	let synchronizer = null
	const report = (state, error = "") =>
		local.setPartialValues({ [LOCAL_KEYS.syncState]: state, [LOCAL_KEYS.lastSyncError]: error })

	function dropped(reason) {
		synchronizer?.destroy()
		synchronizer = null
		if (stopped) return
		report("offline", reason)
		clearTimeout(retry)
		retry = setTimeout(attempt, BACKOFF_MS[Math.min(drops++, BACKOFF_MS.length - 1)])
	}

	async function connect() {
		report("connecting")
		const answer = await knock(serverUrl, token)
		if (stopped) return
		if (answer === "unauthorised") return report("locked", token ? "wrong token" : "")
		if (answer === "unreachable") return dropped("server unreachable")

		socket = new WebSocket(wsUrl(serverUrl, token))
		socket.addEventListener("close", (event) => {
			dropped(event.code === 1006 ? "connection lost" : event.reason || `closed (${event.code})`)
		})
		synchronizer = await createWsSynchronizer(store, socket, 8)
		if (stopped) return synchronizer.destroy()
		await synchronizer.startSync()
		drops = 0
		report("online")
	}

	// Anything that throws closes the socket, and its `close` schedules the retry.
	function attempt() {
		connect().catch((error) => {
			if (stopped) return
			report("offline", String(error.message ?? error))
			socket?.close()
		})
	}

	attempt()
	return () => {
		stopped = true
		clearTimeout(retry)
		synchronizer?.destroy()
		socket?.close()
	}
}

/**
 * "ok", "unauthorised" or "unreachable". The public health check says whether
 * a token is wanted, so no token means no request that is bound to be refused.
 */
async function knock(serverUrl, token) {
	const base = normaliseServerUrl(serverUrl)
	try {
		const health = await (await fetch(`${base}/api/health`)).json()
		if (health?.ok !== true) return "unreachable"
		if (!health.locked) return "ok"
		if (!token) return "unauthorised"
		const response = await fetch(`${base}/api/info`, { headers: { Authorization: `Bearer ${token}` } })
		if (response.status === 401) return "unauthorised"
		return response.ok ? "ok" : "unreachable"
	} catch {
		return "unreachable"
	}
}

/** One short sync, for the background task: connect, exchange, leave. */
export async function syncOnce(store, local, ms = 4000) {
	const serverUrl = local.getValue(LOCAL_KEYS.serverUrl)
	if (!serverUrl) return false
	const socket = new WebSocket(wsUrl(serverUrl, local.getValue(LOCAL_KEYS.token)))
	try {
		const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))
		const synchronizer = await Promise.race([createWsSynchronizer(store, socket, 5), timeout])
		await synchronizer.startSync()
		await new Promise((resolve) => setTimeout(resolve, ms))
		synchronizer.destroy()
		return true
	} catch {
		return false
	} finally {
		socket.close()
	}
}
