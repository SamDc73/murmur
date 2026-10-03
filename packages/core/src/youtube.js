import getVideoId from "get-video-id"

// Turning whatever was pasted into something the server can fetch. The video
// id — every YouTube host and path shape — is get-video-id's job; this adds
// the playlist and start time, and one canonical URL per video.

// get-video-id finds the id; YouTube ids are always exactly eleven of these.
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const LIST_ID = /^[A-Za-z0-9_-]{12,}$/

/**
 * @returns {{ url: string, videoId: string, playlistId: string, start: number } | null}
 *   `url` is canonical: https://www.youtube.com/watch?v=ID (plus &list= when
 *   the link carried one), or …/playlist?list=ID for a playlist alone.
 */
export function parseYouTubeUrl(input) {
	const text = String(input ?? "").trim()
	if (text === "") return null
	let url
	try {
		url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`)
	} catch {
		return null
	}
	const found = getVideoId(url.href)
	const isYouTube = found.service === "youtube" || /(^|\.)youtube(-nocookie)?\.com$/.test(url.hostname)
	if (!isYouTube) return null
	const videoId = found.service === "youtube" && VIDEO_ID.test(found.id ?? "") ? found.id : ""
	const listParam = url.searchParams.get("list") ?? ""
	const playlistId = LIST_ID.test(listParam) ? listParam : ""
	if (videoId === "" && playlistId === "") return null

	const canonical = videoId
		? `https://www.youtube.com/watch?v=${videoId}${playlistId ? `&list=${playlistId}` : ""}`
		: `https://www.youtube.com/playlist?list=${playlistId}`
	return { url: canonical, videoId, playlistId, start: parseStart(url.searchParams.get("t")) }
}

// `t=1h2m3s`, `t=90`, `t=90s` → seconds.
function parseStart(value) {
	const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(value ?? "")
	if (!match) return 0
	return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
}
