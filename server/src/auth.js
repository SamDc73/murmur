import { timingSafeEqual } from "node:crypto"

// One token, three places it may arrive: a Bearer header (fetch from the app),
// a `token` query (an <audio> element or a WebSocket cannot set headers), or
// nothing at all when MURMUR_TOKEN is unset.

export function tokenFrom(url, headers) {
	const auth = headers.get?.("authorization") ?? headers.authorization ?? ""
	const bearer = /^Bearer\s+(.+)$/i.exec(auth)
	if (bearer) return bearer[1].trim()
	return new URL(url, "http://local").searchParams.get("token") ?? ""
}

export function isAuthorised(expected, presented) {
	if (expected === "") return true
	if (typeof presented !== "string") return false
	const a = Buffer.from(expected)
	const b = Buffer.from(presented)
	return a.length === b.length && timingSafeEqual(a, b)
}
