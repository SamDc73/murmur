import { describe, expect, test } from "bun:test"
import { introEnd } from "../src/schema.js"

// Chapter lists as real episodes have them.
const chapters = (...pairs) => pairs.map(([start, title]) => ({ start, title }))

describe("introEnd", () => {
	test("past an opening chapter named as an intro", () => {
		expect(introEnd(chapters([0, "Intro"], [46, "Demis Hassabis: From Chess Prodigy"]))).toBe(46)
		expect(introEnd(chapters([0, "Introduction"], [13, "Dropped out to chase AI"]))).toBe(13)
		expect(introEnd(chapters([0, "Introduction to David Sacks"], [131, "Early career and PayPal"]))).toBe(131)
		expect(introEnd(chapters([0, "Introducing Joe Tsai"], [49, "Owning the Nets"]))).toBe(49)
		expect(introEnd(chapters([0, "Meet David Singleton"], [31, "What Is Dreamer"]))).toBe(31)
		expect(introEnd(chapters([0, "Cold open"], [71, "Who’s Neel Nanda?"]))).toBe(71)
		expect(introEnd(chapters([0, "Preview."], [49, "Ketosis benefits"]))).toBe(49)
		expect(introEnd(chapters([0, "<Untitled Chapter 1>"], [62, "What does stagnation mean?"]))).toBe(62)
	})

	test("past several in a row: highlights, then the introduction", () => {
		expect(introEnd(chapters([0, "Episode highlight"], [81, "Introduction"], [150, "Psychology"]))).toBe(150)
	})

	test("not when it would skip more than four minutes", () => {
		expect(introEnd(chapters([0, "Introduction"], [1705, "EV Project Origins"]))).toBe(0)
		expect(introEnd(chapters([0, "<Untitled Chapter 1>"], [1069, "Cicero"]))).toBe(0)
		expect(introEnd(chapters([0, "Episode highlight"], [81, "Introduction"], [400, "Psychology"]))).toBe(81)
	})

	test("not for a first chapter that is the show, or an intro further in", () => {
		expect(introEnd(chapters([0, "The Kaiser Steel takeover"], [300, "Intro"]))).toBe(0)
		expect(introEnd(chapters([0, "Introspection and Databases"], [60, "More"]))).toBe(0)
		expect(introEnd(chapters([0, "Meeting the team"], [60, "More"]))).toBe(0)
		expect(introEnd(chapters([0, "Intro"]))).toBe(0)
		expect(introEnd([])).toBe(0)
	})
})
