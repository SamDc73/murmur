import { normaliseServerUrl } from "@murmur/core"

// The device-local store: settings that must not sync, because they describe
// this device (its id, its server credentials, its download rules).
export const LOCAL = "local"

export const LOCAL_KEYS = {
	deviceId: "deviceId",
	serverUrl: "serverUrl",
	token: "token",
	autoDownload: "autoDownload",
	wifiOnly: "wifiOnly",
	deleteAfterPlay: "deleteAfterPlay",
	syncState: "syncState", // off | connecting | online | offline | locked (the server wants a token)
	lastSyncError: "lastSyncError",
}

const LOCAL_DEFAULTS = {
	deviceId: "",
	serverUrl: "",
	token: "",
	autoDownload: true,
	wifiOnly: true,
	deleteAfterPlay: true,
	syncState: "off",
	lastSyncError: "",
}

export function localSetting(values, key) {
	const value = values?.[key]
	return value === undefined || value === null ? LOCAL_DEFAULTS[key] : value
}

export function wsUrl(serverUrl, token) {
	const url = new URL(`${normaliseServerUrl(serverUrl)}/sync`)
	url.protocol = url.protocol === "http:" ? "ws:" : "wss:"
	if (token) url.searchParams.set("token", token)
	return url.toString()
}

/** A file the server keeps in DATA_DIR/media: "<itemId>.m4a", "<itemId>.transcript.json". */
export function mediaUrl(serverUrl, token, fileName, version) {
	const url = new URL(`${normaliseServerUrl(serverUrl)}/api/media/${encodeURIComponent(fileName)}`)
	if (token) url.searchParams.set("token", token)
	if (version) url.searchParams.set("v", String(version))
	return url.toString()
}
