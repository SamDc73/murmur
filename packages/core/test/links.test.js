import { describe, expect, test } from "bun:test"
import { classifyLinks } from "../src/links.js"
import { extractYouTubeLinks } from "../src/youtube.js"

const items = {
	a: { videoId: "jNQXAC9IVRw", doneAt: 0 },
	b: { videoId: "LeAltgu_pbM", doneAt: 1700 },
	c: { videoId: "", doneAt: 0 },
}

describe("classifyLinks", () => {
	test("new, already queued and already played are told apart", () => {
		const links = extractYouTubeLinks(
			"https://youtu.be/jNQXAC9IVRw https://youtu.be/LeAltgu_pbM https://youtu.be/dQw4w9WgXcQ"
		)
		const { fresh, queued, played } = classifyLinks(links, items)
		expect(fresh.map((l) => l.videoId)).toEqual(["dQw4w9WgXcQ"])
		expect(queued.map((q) => q.id)).toEqual(["a"])
		expect(played.map((p) => p.id)).toEqual(["b"])
	})
	test("a playlist link is always new; an empty queue makes everything new", () => {
		const links = extractYouTubeLinks(
			"https://www.youtube.com/playlist?list=PLabcdefghijklmnop https://youtu.be/jNQXAC9IVRw"
		)
		expect(classifyLinks(links, items).fresh.map((l) => l.playlistId || l.videoId)).toEqual(["PLabcdefghijklmnop"])
		expect(classifyLinks(links, {}).fresh.length).toBe(2)
	})
	test("queued wins when a video is both queued and in History", () => {
		const both = { x: { videoId: "jNQXAC9IVRw", doneAt: 5 }, y: { videoId: "jNQXAC9IVRw", doneAt: 0 } }
		const { queued, played } = classifyLinks(extractYouTubeLinks("https://youtu.be/jNQXAC9IVRw"), both)
		expect(queued.map((q) => q.id)).toEqual(["y"])
		expect(played).toEqual([])
	})
})
