import { describe, expect, test } from "bun:test"
import { normaliseSponsorSegments, parseSponsorSegments, setting, sponsorEnd, VALUES } from "../src/index.js"

describe("SponsorBlock segments", () => {
	test("only paid promotion skip ranges are kept, cleaned and sorted", () => {
		expect(
			normaliseSponsorSegments([
				{ category: "sponsor", actionType: "skip", segment: [40, 50] },
				{ category: "intro", actionType: "skip", segment: [0, 5] },
				{ category: "sponsor", actionType: "mute", segment: [20, 25] },
				{ category: "sponsor", actionType: "skip", segment: [10, 20] },
				{ category: "sponsor", actionType: "skip", segment: [60, 60] },
			])
		).toEqual([
			{ start: 10, end: 20 },
			{ start: 40, end: 50 },
		])
	})

	test("stored ranges survive malformed JSON and malformed entries", () => {
		expect(parseSponsorSegments({ sponsorSegments: "not json" })).toEqual([])
		expect(
			parseSponsorSegments({
				sponsorSegments: JSON.stringify([
					{ start: 2, end: 4 },
					{ start: -1, end: 8 },
				]),
			})
		).toEqual([{ start: 2, end: 4 }])
	})

	test("a position inside a range resumes after it, including connected ranges", () => {
		const segments = normaliseSponsorSegments([
			[30, 40],
			[10, 20],
			[20, 25],
			[18, 22],
		])
		expect(sponsorEnd(segments, 9.9)).toBe(0)
		expect(sponsorEnd(segments, 10)).toBe(25)
		expect(sponsorEnd(segments, 19)).toBe(25)
		expect(sponsorEnd(segments, 24)).toBe(25)
		expect(sponsorEnd(segments, 25)).toBe(0)
		expect(sponsorEnd(segments, 35)).toBe(40)
	})

	test("sponsor skipping is on by default", () => {
		expect(setting({}, VALUES.skipSponsors)).toBe(true)
	})
})
