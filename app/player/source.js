import { COPY_STATE, DEVICE_SERVER } from "@murmur/core"
import { mediaUrl } from "../store/local"

// Where an item plays from, in order of preference: the file on this device,
// then the server's stream, else nowhere (yet). The web has no local files.

export function sourceFor({ copies, deviceId, serverUrl, token }) {
	const mine = copies[deviceId]
	const server = copies[DEVICE_SERVER]
	// The phone's own file, unless the server has since got the other kind
	// (the phone is about to swap): then the server's, which is what was asked for.
	const swapping = server?.state === COPY_STATE.ready && server.kind !== mine?.kind && serverUrl
	if (mine && mine.state === COPY_STATE.ready && mine.uri && !swapping) {
		return { url: mine.uri, kind: mine.kind }
	}
	if (server && server.state === COPY_STATE.ready && serverUrl) {
		return { url: mediaUrl(serverUrl, token, server.uri, server.updatedAt), kind: server.kind }
	}
	return null
}
