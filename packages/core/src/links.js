import { parseYouTubeUrl } from "./youtube.js"

// What a paste can bring in: YouTube videos and playlists, and Google Docs
// whose YouTube links the server imports.

// docs.google.com/document/d/<id>/… — a share link — or /d/e/<id>/pub, a
// doc published to the web. Either way the server reads it as HTML, where
// every link survives, even one hidden behind words: a shared doc through its
// light mobile view (quick, unlike the HTML export, which embeds images and
// can stall), a published one where it's published.
const DOC = /^\/document\/(?:u\/\d+\/)?d\/(e\/)?([A-Za-z0-9_-]{20,})/

/** @returns {{ url: string, videoId: "", playlistId: "", start: 0, docUrl: string } | null} */
export function parseGoogleDocUrl(input) {
	const text = String(input ?? "").trim()
	let url
	try {
		url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`)
	} catch {
		return null
	}
	const match = url.hostname === "docs.google.com" ? DOC.exec(url.pathname) : null
	if (match === null) return null
	const [, published, id] = match
	const docUrl = published
		? `https://docs.google.com/document/d/e/${id}/pub`
		: `https://docs.google.com/document/d/${id}/mobilebasic`
	return {
		url: `https://docs.google.com/document/d/${published ?? ""}${id}`,
		videoId: "",
		playlistId: "",
		start: 0,
		docUrl,
	}
}

// A paste can be one link or a whole list — one per line, comma-separated,
// or even run together with nothing between them (a single-line field eats
// newlines). Every recognisable link comes back once, in order.
export function extractLinks(text) {
	const seen = new Set()
	const links = []
	const spaced = String(text ?? "")
		// "…v=IDhttps://youtu.be/…" → a space before every scheme
		.replace(/https?:\/\//gi, " $&")
		// "…v=IDyoutu.be/…" → a space before a bare host glued to something
		.replace(/([^\s./])((?:www\.|m\.|music\.)?youtu(?:\.be|be\.com)\/)/gi, "$1 $2")
	for (const token of spaced.split(/[\s<>"'()[\]{},;]+/)) {
		const parsed = parseYouTubeUrl(token) ?? parseGoogleDocUrl(token)
		if (parsed === null || seen.has(parsed.url)) continue
		seen.add(parsed.url)
		links.push(parsed)
	}
	return links
}

/**
 * Sort pasted links by what the queue already knows about them:
 *   fresh   — never seen: add them
 *   queued  — already waiting in the queue
 *   played  — in History: can come back
 * A link without a video id (a playlist) is always fresh. Rows are matched
 * by video id; if a video is somehow both queued and played, queued wins.
 */
export function classifyLinks(links, items) {
	const queued = new Map()
	const played = new Map()
	for (const [id, row] of Object.entries(items ?? {})) {
		if (!row.videoId) continue
		const bucket = row.doneAt ? played : queued
		if (!bucket.has(row.videoId)) bucket.set(row.videoId, { id, row })
	}
	const result = { fresh: [], queued: [], played: [] }
	for (const link of links) {
		const inQueue = link.videoId ? queued.get(link.videoId) : undefined
		const inHistory = link.videoId ? played.get(link.videoId) : undefined
		if (inQueue) result.queued.push({ link, ...inQueue })
		else if (inHistory) result.played.push({ link, ...inHistory })
		else result.fresh.push(link)
	}
	return result
}
