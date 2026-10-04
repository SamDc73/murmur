import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseJson3, pickCaptionTrack } from "@murmur/core"

// The only file that knows yt-dlp's flags. Two operations: `probe` (metadata
// as JSON, no download) and `download` (one file, progress on stdout). Both
// spawn the binary; the pipeline never sees a command line.

function baseArgs(config) {
	const args = ["--no-warnings", "--no-colors", "--no-playlist-reverse", ...config.ytdlpArgs]
	if (config.cookies && existsSync(config.cookies)) args.push("--cookies", config.cookies)
	return args
}

/** Arguments for `probe`: full JSON for a video, flat entries for a playlist. */
export function probeArgs(config, url, { playlist }) {
	return [...baseArgs(config), "-J", "--skip-download", playlist ? "--flat-playlist" : "--no-playlist", url]
}

/**
 * Arguments for `download`, choosing by yt-dlp's format sorting (-S), as its
 * docs advise over hand-written filters. Audio: the best audio-only stream,
 * AAC (or Opus) first, in the episode's own language; -x converts only if it
 * isn't already that ("Not converting audio … already in target format").
 * Video: the best up to the chosen height — or the highest there is, below
 * it — and H.264 at that height, which every phone and browser decodes in
 * hardware (left alone, yt-dlp prefers AV1 or VP9), merged into an mp4.
 */
export function downloadArgs(config, { url, itemId, kind, audioFormat, videoHeight }) {
	const template = join(config.mediaDir, `${itemId}.%(ext)s`)
	const args = [
		...baseArgs(config),
		"--no-playlist",
		"--newline",
		"--continue",
		"--no-mtime",
		"--progress-template",
		"download:murmur|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s",
		"--print",
		"after_move:filepath",
		"-o",
		template,
	]
	if (kind === "video") {
		const h = Number(videoHeight) || 720
		args.push("-f", "bv*+ba/b", "-S", `res:${h},vcodec:h264,acodec:aac`, "--merge-output-format", "mp4")
	} else if (audioFormat === "opus") {
		args.push("-f", "ba", "-S", "acodec:opus", "-x", "--audio-format", "opus")
	} else {
		args.push("-f", "ba", "-S", "acodec:aac", "-x", "--audio-format", "m4a")
	}
	args.push(url)
	return args
}

/** One progress line → {downloaded, total} or null when it is not ours. */
export function parseProgressLine(line) {
	if (!line.startsWith("murmur|")) return null
	const [, downloaded, total, estimate] = line.trim().split("|")
	const done = Number(downloaded) || 0
	const size = Number(total) || Number(estimate) || 0
	return { downloaded: done, total: size }
}

async function run(config, args, { onLine } = {}) {
	const proc = Bun.spawn([config.ytdlp, ...args], { stdout: "pipe", stderr: "pipe" })
	let stdout = ""
	const reading = (async () => {
		const reader = proc.stdout.getReader()
		const decoder = new TextDecoder()
		let buffer = ""
		for (;;) {
			const { value, done } = await reader.read()
			if (done) break
			const chunk = decoder.decode(value, { stream: true })
			stdout += chunk
			if (!onLine) continue
			buffer += chunk
			const lines = buffer.split("\n")
			buffer = lines.pop() ?? ""
			for (const line of lines) onLine(line)
		}
		if (onLine && buffer !== "") onLine(buffer)
	})()
	const stderr = new Response(proc.stderr).text()
	const [code] = await Promise.all([proc.exited, reading])
	const err = await stderr
	if (code !== 0) {
		throw new Error(summariseError(err) || `yt-dlp exited with ${code}`)
	}
	return { stdout, stderr: err }
}

// yt-dlp's last ERROR line, without the "ERROR: [youtube] id:" prefix.
export function summariseError(stderr) {
	const lines = String(stderr).trim().split("\n").filter(Boolean)
	const error = [...lines].reverse().find((line) => /^ERROR/.test(line)) ?? lines.at(-1) ?? ""
	return error
		.replace(/^ERROR:\s*/, "")
		.replace(/^\[[^\]]+\]\s*[\w-]{11}:\s*/, "")
		.slice(0, 300)
}

export async function probe(config, url, { playlist = false } = {}) {
	const { stdout } = await run(config, probeArgs(config, url, { playlist }))
	return JSON.parse(stdout)
}

/** The address of YouTube's HLS master playlist for a video, or "" if it has none. */
export async function hlsManifest(config, url) {
	const info = await probe(config, url)
	return info.formats?.find((format) => String(format.protocol).startsWith("m3u8"))?.manifest_url ?? ""
}

/**
 * Download one item. Resolves with the final file path. `onProgress` gets
 * {downloaded, total} at most as often as yt-dlp prints.
 */
export async function download(config, item, onProgress) {
	let filepath = ""
	const { stdout } = await run(config, downloadArgs(config, item), {
		onLine(line) {
			const progress = parseProgressLine(line)
			if (progress) onProgress?.(progress)
			else if (line.startsWith("/") || /^[A-Za-z]:\\/.test(line)) filepath = line.trim()
		},
	})
	if (filepath === "") {
		// `--print after_move:filepath` is the last thing printed.
		filepath = stdout.trim().split("\n").filter(Boolean).at(-1) ?? ""
	}
	if (filepath === "" || !existsSync(filepath)) throw new Error("yt-dlp finished but produced no file")
	return filepath
}

/** yt-dlp's JSON → the item cells the app shows. Works for full and flat entries. */
export function metadataFrom(info) {
	const chapters = Array.isArray(info.chapters)
		? info.chapters.map((chapter) => ({
				title: String(chapter.title ?? ""),
				start: Number(chapter.start_time) || 0,
				end: Number(chapter.end_time) || 0,
			}))
		: []
	return {
		videoId: String(info.id ?? ""),
		title: String(info.title ?? ""),
		channel: String(info.channel ?? info.uploader ?? ""),
		channelUrl: String(info.channel_url ?? info.uploader_url ?? ""),
		duration: Math.round(Number(info.duration) || 0),
		thumbnail: bestThumbnail(info),
		description: String(info.description ?? ""),
		chapters: JSON.stringify(chapters),
		uploadDate: String(info.upload_date ?? ""),
		...captionCells(info),
	}
}

function captionCells(info) {
	const track = pickCaptionTrack(info)
	return { captionLang: track?.lang ?? "", captionAuto: track?.auto ?? false }
}

/** Arguments for fetching one caption track, and nothing else. */
export function captionArgs(config, { url, itemId, lang, auto }) {
	return [
		...baseArgs(config),
		"--skip-download",
		"--no-playlist",
		auto ? "--write-auto-subs" : "--write-subs",
		"--sub-langs",
		lang,
		"--sub-format",
		"json3",
		"-o",
		join(config.mediaDir, `${itemId}.%(ext)s`),
		url,
	]
}

/**
 * Fetch a caption track and save it as `<itemId>.transcript.json`
 * ({ lang, auto, cues }). The raw file yt-dlp writes is removed.
 * Resolves with the number of cues.
 */
export async function fetchTranscript(config, item) {
	await run(config, captionArgs(config, item))
	const raw = readdirSync(config.mediaDir).find((name) => name.startsWith(`${item.itemId}.`) && name.endsWith(".json3"))
	if (!raw) throw new Error("yt-dlp wrote no captions")
	const path = join(config.mediaDir, raw)
	const text = readFileSync(path, "utf8")
	unlinkSync(path)
	const cues = parseJson3(JSON.parse(text))
	if (cues.length === 0) throw new Error("the captions were empty")
	writeFileSync(transcriptPath(config, item.itemId), JSON.stringify({ lang: item.lang, auto: item.auto, cues }))
	return cues.length
}

export function transcriptPath(config, itemId) {
	return join(config.mediaDir, `${itemId}.transcript.json`)
}

function bestThumbnail(info) {
	if (typeof info.thumbnail === "string" && info.thumbnail !== "") return info.thumbnail
	const list = Array.isArray(info.thumbnails) ? info.thumbnails : []
	// Prefer a landscape ~480px wide frame: crisp in a row, cheap to cache.
	const sorted = [...list]
		.filter((t) => typeof t.url === "string")
		.sort((a, b) => Math.abs((a.width ?? 0) - 480) - Math.abs((b.width ?? 0) - 480))
	if (sorted[0]) return sorted[0].url
	return info.id ? `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg` : ""
}
