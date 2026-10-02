// Reaching a server: what a typed address means, and the pairing link.

// Addresses that only exist on a home network (or this machine) are plain
// http — nobody has a certificate for localhost or 192.168.1.5. Everything
// else is assumed to be behind TLS.
const LOCAL_HOST =
	/^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[?::1\]?|[\w-]+\.local|[\w-]+)(:\d+)?(\/|$)/i

/** "localhost:3000" → "http://localhost:3000"; "murmur.example.com/" → "https://murmur.example.com" */
export function normaliseServerUrl(input) {
	let text = String(input ?? "").trim()
	if (text === "") return ""
	if (!/^[a-z]+:\/\//i.test(text)) text = `${LOCAL_HOST.test(text) ? "http" : "https"}://${text}`
	return text.replace(/\/+$/, "")
}

// The pairing link: everything a phone needs to join a server, in one string
// that fits a QR code and doubles as a tap-link (`murmur://` is the app's scheme).
//   murmur://pair?server=https%3A%2F%2Fmurmur.example.com&token=…

const SCHEME = "murmur"
const HOST = "pair"

export function pairLink(serverUrl, token) {
	const params = new URLSearchParams({ server: serverUrl })
	if (token) params.set("token", token)
	return `${SCHEME}://${HOST}?${params}`
}

/** @returns {{ serverUrl: string, token: string } | null} */
export function parsePairLink(text) {
	const trimmed = String(text ?? "").trim()
	if (!trimmed.startsWith(`${SCHEME}://${HOST}`)) return null
	const query = trimmed.slice(trimmed.indexOf("?") + 1)
	if (query === trimmed) return null
	const params = new URLSearchParams(query)
	const serverUrl = (params.get("server") ?? "").trim().replace(/\/+$/, "")
	if (!/^https?:\/\/\S+$/.test(serverUrl)) return null
	return { serverUrl, token: (params.get("token") ?? "").trim() }
}
