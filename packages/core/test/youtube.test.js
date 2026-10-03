import { describe, expect, test } from "bun:test"
import { extractLinks } from "../src/links.js"
import { parseYouTubeUrl } from "../src/youtube.js"

describe("parseYouTubeUrl", () => {
	test("watch, short, mobile, music and nocookie hosts all canonicalise", () => {
		const forms = [
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			"https://youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
			"youtu.be/dQw4w9WgXcQ",
			"https://youtu.be/dQw4w9WgXcQ?si=abc",
			"https://m.youtube.com/watch?v=dQw4w9WgXcQ",
			"https://music.youtube.com/watch?v=dQw4w9WgXcQ",
			"https://www.youtube.com/shorts/dQw4w9WgXcQ",
			"https://www.youtube.com/live/dQw4w9WgXcQ",
			"https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
		]
		for (const form of forms) {
			expect(parseYouTubeUrl(form)?.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
			expect(parseYouTubeUrl(form)?.videoId).toBe("dQw4w9WgXcQ")
		}
	})
	test("keeps the list when a video link carries one; a bare playlist stays a playlist", () => {
		const both = parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdefghijklmnop")
		expect(both.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdefghijklmnop")
		const list = parseYouTubeUrl("https://www.youtube.com/playlist?list=PLabcdefghijklmnop")
		expect(list).toEqual({
			url: "https://www.youtube.com/playlist?list=PLabcdefghijklmnop",
			videoId: "",
			playlistId: "PLabcdefghijklmnop",
			start: 0,
		})
	})
	test("start times", () => {
		expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?t=90").start).toBe(90)
		expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?t=1h2m3s").start).toBe(3723)
		expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?t=2m").start).toBe(120)
	})
	test("rejects other hosts, garbage and bad ids", () => {
		expect(parseYouTubeUrl("https://vimeo.com/123")).toBeNull()
		expect(parseYouTubeUrl("not a link")).toBeNull()
		expect(parseYouTubeUrl("https://www.youtube.com/watch?v=short")).toBeNull()
		expect(parseYouTubeUrl("")).toBeNull()
		expect(parseYouTubeUrl(null)).toBeNull()
	})
})

describe("extractLinks", () => {
	test("finds every link in a pasted list, once each, in order", () => {
		const text = `
			ep 1: https://youtu.be/dQw4w9WgXcQ
			ep 2 https://www.youtube.com/watch?v=jNQXAC9IVRw (good one)
			https://youtu.be/dQw4w9WgXcQ again
			https://example.com/nope
		`
		expect(extractLinks(text).map((l) => l.videoId)).toEqual(["dQw4w9WgXcQ", "jNQXAC9IVRw"])
	})
	test("lists in every shape: lines, commas, and links run together", () => {
		const lines =
			"https://youtu.be/dQw4w9WgXcQ\nhttps://youtu.be/jNQXAC9IVRw\nhttps://www.youtube.com/watch?v=9bZkp7q19f0"
		expect(extractLinks(lines).map((l) => l.videoId)).toEqual(["dQw4w9WgXcQ", "jNQXAC9IVRw", "9bZkp7q19f0"])
		const commas = "https://youtu.be/dQw4w9WgXcQ, https://youtu.be/jNQXAC9IVRw;https://youtu.be/9bZkp7q19f0"
		expect(extractLinks(commas).length).toBe(3)
		// What a single-line field makes of a multi-line paste: newlines gone.
		const glued = "https://youtu.be/dQw4w9WgXcQhttps://www.youtube.com/watch?v=jNQXAC9IVRwyoutu.be/9bZkp7q19f0"
		expect(extractLinks(glued).map((l) => l.videoId)).toEqual(["dQw4w9WgXcQ", "jNQXAC9IVRw", "9bZkp7q19f0"])
	})
	test("empty for nothing", () => {
		expect(extractLinks("")).toEqual([])
	})
})
