import { describe, expect, test } from "bun:test"
import { channelVideosUrl, newSubscription, remember, seenOf, unseenIds } from "../src/subscriptions.js"

describe("channelVideosUrl", () => {
	test("every channel link shape becomes its uploads page", () => {
		const forms = [
			"https://www.youtube.com/@Fireship",
			"youtube.com/@Fireship",
			"https://www.youtube.com/@Fireship/",
			"https://www.youtube.com/@Fireship/videos",
			"https://m.youtube.com/@Fireship",
			"https://www.youtube.com/channel/UCsXVk37bltHxD1rDPwtNM8Q",
			"https://www.youtube.com/c/Fireship",
			"https://www.youtube.com/user/Fireship",
		]
		for (const form of forms) expect(channelVideosUrl(form)).toStartWith("https://www.youtube.com/")
		expect(channelVideosUrl(forms[0])).toBe("https://www.youtube.com/@Fireship/videos")
		expect(channelVideosUrl(forms[3])).toBe("https://www.youtube.com/@Fireship/videos")
		expect(channelVideosUrl(forms[5])).toBe("https://www.youtube.com/channel/UCsXVk37bltHxD1rDPwtNM8Q/videos")
	})
	test("videos, playlists and other sites are not channels", () => {
		for (const other of [
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			"https://youtu.be/dQw4w9WgXcQ",
			"https://www.youtube.com/playlist?list=PLabcdefghijklmnop",
			"https://example.com/@Fireship",
			"",
			"not a link",
		]) {
			expect(channelVideosUrl(other)).toBeNull()
		}
	})
})

describe("unseenIds", () => {
	test("what's new, oldest first, from a newest-first listing", () => {
		expect(unseenIds(["c", "b", "a"], ["a"])).toEqual(["b", "c"])
	})
	test("nothing new when everything is seen", () => {
		expect(unseenIds(["b", "a"], ["a", "b"])).toEqual([])
	})
})

describe("remember", () => {
	test("keeps every listed id, even if the seen list is full", () => {
		const seen = Array.from({ length: 300 }, (_, index) => `old${index}`)
		const kept = remember(seen, ["new2", "new1"])
		expect(kept).toHaveLength(200)
		expect(kept).toContain("new1")
		expect(kept).toContain("new2")
		expect(kept.at(-1)).toBe("new2")
	})
	test("an id that is listed again is not added twice", () => {
		expect(remember(["a", "b"], ["b", "a"])).toEqual(["a", "b"])
	})
})

describe("subscription rows", () => {
	test("a new row remembers what was listed, so only later uploads count", () => {
		const row = newSubscription({ url: "u", channelId: "UC1", title: "T", seen: ["c", "b", "a"], addedAt: 1 })
		expect(unseenIds(["d", "c", "b", "a"], seenOf(row))).toEqual(["d"])
	})
	test("bad JSON in the seen cell reads as nothing seen", () => {
		expect(seenOf({ seen: "{nope" })).toEqual([])
		expect(seenOf({})).toEqual([])
	})
})
