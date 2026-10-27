import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { fetchSponsorSegments } from "../src/sponsorblock.js"

const videoId = "dQw4w9WgXcQ"

describe("SponsorBlock API", () => {
	test("asks by hash prefix, then keeps only the exact video's sponsor skips", async () => {
		let requested
		const segments = await fetchSponsorSegments(videoId, async (url) => {
			requested = url
			return Response.json([
				{ videoID: "another-video", segments: [{ category: "sponsor", actionType: "skip", segment: [1, 2] }] },
				{
					videoID: videoId,
					segments: [
						{ category: "sponsor", actionType: "skip", segment: [12.5, 30] },
						{ category: "selfpromo", actionType: "skip", segment: [40, 50] },
					],
				},
			])
		})
		const prefix = createHash("sha256").update(videoId).digest("hex").slice(0, 4)
		expect(requested.pathname).toBe(`/api/skipSegments/${prefix}`)
		expect(requested.searchParams.get("categories")).toBe('["sponsor"]')
		expect(requested.searchParams.get("actionTypes")).toBe('["skip"]')
		expect(segments).toEqual([{ start: 12.5, end: 30 }])
	})

	test("no submissions is an empty answer, not an error", async () => {
		const segments = await fetchSponsorSegments(videoId, async () => new Response("Not Found", { status: 404 }))
		expect(segments).toEqual([])
	})

	test("an API failure reaches the pipeline", async () => {
		expect(fetchSponsorSegments(videoId, async () => new Response("busy", { status: 503 }))).rejects.toThrow(
			"SponsorBlock returned HTTP 503"
		)
	})
})
