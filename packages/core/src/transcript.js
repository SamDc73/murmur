// Captions → a transcript: which track to fetch, and how to read it.
// A cue is { s, e, t }: start and end in seconds, and its text.

/**
 * The best caption track in yt-dlp's info: human-written captions in the
 * video's language, then any human English, then any human track; failing
 * that, YouTube's own speech recognition in the original language.
 * @returns {{ lang: string, auto: boolean } | null}
 */
export function pickCaptionTrack(info) {
	const manual = withoutChat(info?.subtitles)
	const auto = withoutChat(info?.automatic_captions)
	const language = info?.language || ""
	const manualLangs = Object.keys(manual)
	const human = first(manual, [
		language,
		...manualLangs.filter((lang) => language && lang.startsWith(`${language}-`)),
		...manualLangs.filter((lang) => /^en(-|$)/.test(lang)),
		manualLangs[0],
	])
	if (human) return { lang: human, auto: false }
	const machine = first(auto, [
		language && `${language}-orig`,
		language,
		...Object.keys(auto).filter((lang) => lang.endsWith("-orig")),
		"en",
	])
	return machine ? { lang: machine, auto: true } : null
}

function withoutChat(tracks) {
	const { live_chat: _chat, ...rest } = tracks ?? {}
	return rest
}

function first(tracks, candidates) {
	return candidates.find((lang) => lang && tracks[lang]?.length > 0) ?? null
}

/** YouTube's json3 caption format → cues. */
export function parseJson3(json) {
	const cues = []
	for (const event of json?.events ?? []) {
		if (!event.segs) continue
		const text = clean(event.segs.map((seg) => seg.utf8 ?? "").join(""))
		if (!text) continue
		const start = (event.tStartMs ?? 0) / 1000
		cues.push({ s: round(start), e: round(start + (event.dDurationMs ?? 0) / 1000), t: text })
	}
	return cues
}

/** Index of the cue playing at `time` (the last one started), or -1. */
export function cueIndexAt(cues, time) {
	let low = 0
	let high = cues.length - 1
	let found = -1
	while (low <= high) {
		const mid = (low + high) >> 1
		if (cues[mid].s <= time) {
			found = mid
			low = mid + 1
		} else {
			high = mid - 1
		}
	}
	return found
}

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " }

function clean(text) {
	return String(text)
		.replace(/<[^>]+>/g, "")
		.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity])
		.replace(/\s+/g, " ")
		.trim()
}

function round(value) {
	return Math.round(value * 100) / 100
}
