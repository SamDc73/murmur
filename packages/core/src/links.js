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
