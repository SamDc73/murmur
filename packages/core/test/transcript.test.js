import { describe, expect, test } from "bun:test"
import { cueIndexAt, parseJson3, pickCaptionTrack } from "../src/transcript.js"

describe("pickCaptionTrack", () => {
	const track = [{ ext: "json3" }]
	test("human captions in the video's language win", () => {
		expect(
			pickCaptionTrack({
				language: "de",
				subtitles: { en: track, de: track },
				automatic_captions: { "de-orig": track },
			})
		).toEqual({ lang: "de", auto: false })
	})
	test("then human English, then any human track", () => {
		expect(pickCaptionTrack({ subtitles: { fr: track, "en-GB": track } })).toEqual({ lang: "en-GB", auto: false })
		expect(pickCaptionTrack({ subtitles: { fr: track } })).toEqual({ lang: "fr", auto: false })
	})
	test("then machine captions in the original language", () => {
		expect(
			pickCaptionTrack({
				language: "en",
				subtitles: {},
				automatic_captions: { fr: track, "en-orig": track, en: track },
			})
		).toEqual({ lang: "en-orig", auto: true })
		expect(pickCaptionTrack({ automatic_captions: { "es-orig": track, en: track } })).toEqual({
			lang: "es-orig",
			auto: true,
		})
	})
	test("live chat is not a transcript; nothing is null", () => {
		expect(pickCaptionTrack({ subtitles: { live_chat: track } })).toBeNull()
		expect(pickCaptionTrack({})).toBeNull()
	})
})

describe("parseJson3", () => {
	test("events become cues; newline-only events and empty text are dropped", () => {
		const json = {
			events: [
				{ tStartMs: 0, dDurationMs: 2400 },
				{ tStartMs: 1200, dDurationMs: 3100, segs: [{ utf8: "All right, " }, { utf8: "so here we are" }] },
				{ tStartMs: 4300, dDurationMs: 10, aAppend: 1, segs: [{ utf8: "\n" }] },
				{ tStartMs: 4310, dDurationMs: 2000, segs: [{ utf8: "in front of the &amp; elephants" }] },
			],
		}
		expect(parseJson3(json)).toEqual([
			{ s: 1.2, e: 4.3, t: "All right, so here we are" },
			{ s: 4.31, e: 6.31, t: "in front of the & elephants" },
		])
		expect(parseJson3({})).toEqual([])
	})
})

describe("cueIndexAt", () => {
	const cues = [{ s: 1 }, { s: 4 }, { s: 9 }]
	test("the last cue that has started", () => {
		expect(cueIndexAt(cues, 0.5)).toBe(-1)
		expect(cueIndexAt(cues, 1)).toBe(0)
		expect(cueIndexAt(cues, 8.99)).toBe(1)
		expect(cueIndexAt(cues, 100)).toBe(2)
		expect(cueIndexAt([], 3)).toBe(-1)
	})
})
