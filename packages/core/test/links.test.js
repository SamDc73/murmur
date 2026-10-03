import { describe, expect, test } from "bun:test"
import { classifyLinks, extractLinks, parseGoogleDocUrl } from "../src/links.js"

const items = {
	a: { videoId: "jNQXAC9IVRw", doneAt: 0 },
	b: { videoId: "LeAltgu_pbM", doneAt: 1700 },
	c: { videoId: "", doneAt: 0 },
}

describe("classifyLinks", () => {
	test("new, already queued and already played are told apart", () => {
		const links = extractLinks("https://youtu.be/jNQXAC9IVRw https://youtu.be/LeAltgu_pbM https://youtu.be/dQw4w9WgXcQ")
		const { fresh, queued, played } = classifyLinks(links, items)
		expect(fresh.map((l) => l.videoId)).toEqual(["dQw4w9WgXcQ"])
		expect(queued.map((q) => q.id)).toEqual(["a"])
		expect(played.map((p) => p.id)).toEqual(["b"])
	})
	test("a playlist link is always new; an empty queue makes everything new", () => {
		const links = extractLinks("https://www.youtube.com/playlist?list=PLabcdefghijklmnop https://youtu.be/jNQXAC9IVRw")
		expect(classifyLinks(links, items).fresh.map((l) => l.playlistId || l.videoId)).toEqual(["PLabcdefghijklmnop"])
		expect(classifyLinks(links, {}).fresh.length).toBe(2)
	})
	test("queued wins when a video is both queued and in History", () => {
		const both = { x: { videoId: "jNQXAC9IVRw", doneAt: 5 }, y: { videoId: "jNQXAC9IVRw", doneAt: 0 } }
		const { queued, played } = classifyLinks(extractLinks("https://youtu.be/jNQXAC9IVRw"), both)
		expect(queued.map((q) => q.id)).toEqual(["y"])
		expect(played).toEqual([])
	})
})

describe("Google Docs links", () => {
	const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"
	test("a share link, with or without its tail, is read as HTML", () => {
		for (const link of [
			`https://docs.google.com/document/d/${id}/edit?usp=sharing`,
			`docs.google.com/document/d/${id}`,
			`https://docs.google.com/document/u/0/d/${id}/view`,
		]) {
			expect(parseGoogleDocUrl(link)).toMatchObject({
				url: `https://docs.google.com/document/d/${id}`,
				videoId: "",
				docUrl: `https://docs.google.com/document/d/${id}/mobilebasic`,
			})
		}
	})
	test("a published doc is read where it's published", () => {
		expect(parseGoogleDocUrl("https://docs.google.com/document/d/e/2PACX-1vQabcdefghijklmnopqrstuv/pub").docUrl).toBe(
			"https://docs.google.com/document/d/e/2PACX-1vQabcdefghijklmnopqrstuv/pub"
		)
	})
	test("not a doc: sheets, other hosts", () => {
		expect(parseGoogleDocUrl(`https://docs.google.com/spreadsheets/d/${id}/edit`)).toBeNull()
		expect(parseGoogleDocUrl("https://example.com/document/d/x")).toBeNull()
	})
	test("a paste can mix videos and docs, each once", () => {
		const text = `https://youtu.be/jNQXAC9IVRw docs.google.com/document/d/${id}/edit https://docs.google.com/document/d/${id}`
		expect(extractLinks(text).map((link) => link.url)).toEqual([
			"https://www.youtube.com/watch?v=jNQXAC9IVRw",
			`https://docs.google.com/document/d/${id}`,
		])
	})
})
