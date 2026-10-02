import { COPY_STATE, DEVICE_SERVER } from "@murmur/core"

// What a row says after its channel, only while something is happening —
// or wrong. A settled, playable episode says nothing at all.
// Returns { text, tone: "plain" | "error" } or null; `saved` marks a phone
// copy (drawn as a small icon, not words).
export function rowStatus({ row, copies, deviceId, online }) {
	const server = copies[DEVICE_SERVER]
	const mine = deviceId && deviceId !== DEVICE_SERVER ? copies[deviceId] : undefined
	const saved = mine?.state === COPY_STATE.ready
	if (row.error) return { text: "couldn’t fetch", tone: "error", saved }
	if (!row.resolvedAt) return { text: online ? "fetching…" : "waiting for server", tone: "plain", saved }
	if (server?.state === COPY_STATE.error) return { text: "download failed", tone: "error", saved }
	if (server?.state === COPY_STATE.downloading)
		return { text: `${Math.round((server.progress || 0) * 100)}%`, tone: "plain", saved }
	if (mine?.state === COPY_STATE.downloading)
		return { text: `saving ${Math.round((mine.progress || 0) * 100)}%`, tone: "plain", saved }
	return saved ? { text: "", tone: "plain", saved } : null
}
