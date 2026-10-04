import { describe, expect, test } from "bun:test"
import { captionArgs, downloadArgs, metadataFrom, parseProgressLine, probeArgs, summariseError } from "../src/ytdlp.js"

const config = { ytdlpArgs: ["--proxy", "socks5://x"], cookies: "/nonexistent", mediaDir: "/m" }

describe("yt-dlp arguments", () => {
	test("probe: no-playlist for a video, flat for a list", () => {
		expect(probeArgs(config, "u", { playlist: false })).toEqual([
			"--no-warnings",
			"--no-colors",
			"--no-playlist-reverse",
			"--proxy",
			"socks5://x",
			"-J",
			"--skip-download",
			"--no-playlist",
			"u",
		])
		expect(probeArgs(config, "u", { playlist: true })).toContain("--flat-playlist")
	})
	test("download: audio formats and video height", () => {
		const m4a = downloadArgs(config, { url: "u", itemId: "id", kind: "audio", audioFormat: "m4a", videoHeight: 720 })
		expect(m4a).toContain("-x")
		expect(m4a[m4a.indexOf("-f") + 1]).toBe("ba")
		expect(m4a[m4a.indexOf("-S") + 1]).toBe("acodec:aac")
		expect(m4a[m4a.indexOf("--audio-format") + 1]).toBe("m4a")
		expect(m4a[m4a.indexOf("-o") + 1]).toBe("/m/id.%(ext)s")
		expect(m4a.at(-1)).toBe("u")
		const opus = downloadArgs(config, { url: "u", itemId: "id", kind: "audio", audioFormat: "opus" })
		expect(opus[opus.indexOf("--audio-format") + 1]).toBe("opus")
		const video = downloadArgs(config, { url: "u", itemId: "id", kind: "video", videoHeight: 480 })
		expect(video[video.indexOf("-S") + 1]).toBe("res:480,vcodec:h264,acodec:aac")
		expect(video).toContain("--merge-output-format")
		expect(video).not.toContain("-x")
	})
	test("progress lines", () => {
		expect(parseProgressLine("murmur|500|1000|NA")).toEqual({ downloaded: 500, total: 1000 })
		expect(parseProgressLine("murmur|500|NA|2000")).toEqual({ downloaded: 500, total: 2000 })
		expect(parseProgressLine("[download] 12%")).toBeNull()
	})
	test("error summary strips prefixes", () => {
		expect(summariseError("WARNING: x\nERROR: [youtube] dQw4w9WgXcQ: Video unavailable\n")).toBe("Video unavailable")
		expect(summariseError("")).toBe("")
	})
	test("metadata mapping", () => {
		const meta = metadataFrom({
			id: "dQw4w9WgXcQ",
			title: "T",
			channel: "C",
			channel_url: "https://c",
			duration: 61.4,
			thumbnails: [
				{ url: "a", width: 120 },
				{ url: "b", width: 480 },
				{ url: "c", width: 1280 },
			],
			description: "D",
			chapters: [{ title: "Intro", start_time: 0, end_time: 30 }],
			upload_date: "20250101",
		})
		expect(meta).toEqual({
			videoId: "dQw4w9WgXcQ",
			title: "T",
			channel: "C",
			channelUrl: "https://c",
			duration: 61,
			thumbnail: "b",
			description: "D",
			chapters: JSON.stringify([{ title: "Intro", start: 0, end: 30 }]),
			uploadDate: "20250101",
			captionLang: "",
			captionAuto: false,
		})
		expect(metadataFrom({ id: "x" }).chapters).toBe("[]")
		expect(metadataFrom({ id: "x" }).thumbnail).toBe("https://i.ytimg.com/vi/x/hqdefault.jpg")
	})
})

describe("captions", () => {
	test("the probe records the best caption track", () => {
		expect(metadataFrom({ id: "x", subtitles: { en: [{ ext: "json3" }] } })).toMatchObject({
			captionLang: "en",
			captionAuto: false,
		})
		expect(
			metadataFrom({ id: "x", language: "en", automatic_captions: { "en-orig": [{ ext: "vtt" }] } })
		).toMatchObject({ captionLang: "en-orig", captionAuto: true })
	})
	test("fetching asks for that track only, json3 first, next to the media", () => {
		const human = captionArgs(config, { url: "u", itemId: "id", lang: "en", auto: false })
		expect(human).toContain("--skip-download")
		expect(human).toContain("--write-subs")
		expect(human[human.indexOf("--sub-langs") + 1]).toBe("en")
		expect(human[human.indexOf("--sub-format") + 1]).toBe("json3")
		expect(human[human.indexOf("-o") + 1]).toBe("/m/id.%(ext)s")
		expect(captionArgs(config, { url: "u", itemId: "id", lang: "en-orig", auto: true })).toContain("--write-auto-subs")
	})
})
