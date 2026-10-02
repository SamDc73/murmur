// The web app never asks for a URL it can find itself:
//   1. served by the server (Caddy in production): this origin is the server;
//   2. under Metro in development: the server is next door on its default port.
// Only a real Murmur `{ ok: true }` counts — a dev server answers every path
// with the page itself. If neither answers, the URL field appears.
export const ORIGIN = typeof window === "undefined" ? "" : window.location.origin
const NEXT_DOOR = typeof window === "undefined" ? "" : `${window.location.protocol}//${window.location.hostname}:3000`

export async function servedByServer() {
	for (const candidate of [ORIGIN, NEXT_DOOR]) {
		if (candidate && (await isMurmur(candidate))) return candidate
	}
	return ""
}

async function isMurmur(base) {
	try {
		const response = await fetch(`${base}/api/health`)
		const body = response.ok ? await response.json() : null
		return body?.ok === true
	} catch {
		return false
	}
}
