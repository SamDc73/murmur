// Following a YouTube channel. The server does the checking; this is the part
// every surface and the tests can share: which link is a channel, and which
// uploads are new.

// The most ids remembered per channel. A channel is listed 30 at a time, so
// this is comfortably more than one listing.
const SEEN_LIMIT = 200

const CHANNEL = /^\/(@[\w.-]+|channel\/UC[\w-]{22}|c\/[^/]+|user\/[^/]+)$/

/**
 * A channel link, as the page's own uploads list: https://www.youtube.com/@name/videos.
 * Null for anything that isn't a channel (a video, a playlist, another site).
 */
export function channelVideosUrl(input) {
	const text = String(input ?? "").trim()
	if (text === "") return null
	let url
	try {
		url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`)
	} catch {
		return null
	}
	if (!/(^|\.)youtube\.com$/.test(url.hostname)) return null
	const channel = url.pathname.replace(/\/+$/, "").replace(/\/videos$/, "")
	if (!CHANNEL.test(channel)) return null
	return `https://www.youtube.com${channel}/videos`
}

/** Ids in `listed` that aren't in `seen`, oldest first. `listed` is newest first, as YouTube lists them. */
export function unseenIds(listed, seen) {
	const known = new Set(seen)
	return listed.filter((id) => !known.has(id)).reverse()
}

/** `seen` plus `listed`, most recent last, capped. Everything in `listed` is kept. */
export function remember(seen, listed) {
	const latest = new Set(listed)
	return [...seen.filter((id) => !latest.has(id)), ...[...listed].reverse()].slice(-SEEN_LIMIT)
}

/** The seen list off a subscription row. Bad JSON reads as nothing seen. */
export function seenOf(row) {
	try {
		const parsed = JSON.parse(row.seen || "[]")
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

export function newSubscription({ url, channelId, title, seen, addedAt }) {
	return { url, channelId, title, seen: JSON.stringify(remember([], seen)), addedAt }
}
