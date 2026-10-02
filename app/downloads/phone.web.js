// The browser keeps nothing: it streams from the server. These exist so the
// screens import one module on every platform.
export const CAN_DOWNLOAD = false
export function attachDownloads() {
	// nothing to watch on the web
}
