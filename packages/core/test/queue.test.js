import { describe, expect, test } from "bun:test"
import {
	historyOf,
	keyAfter,
	keyBefore,
	keyForMove,
	keysAfter,
	keyToFollow,
	nextUp,
	previousOf,
	queueOf,
	remainingSeconds,
	totalSeconds,
} from "../src/queue.js"

function table(rows) {
	const out = {}
	rows.forEach(([id, order, extra = {}], index) => {
		out[id] = { order, addedAt: index, doneAt: 0, duration: 600, position: 0, ...extra }
	})
	return out
}

describe("queue order", () => {
	test("keys append after and prepend before", () => {
		const a = keyAfter(null)
		const b = keyAfter(a)
		const z = keyBefore(a)
		expect(a < b).toBe(true)
		expect(z < a).toBe(true)
		const many = keysAfter(b, 3)
		expect(many.length).toBe(3)
		expect(many.every((k, i) => k > b && (i === 0 || k > many[i - 1]))).toBe(true)
	})
	test("queueOf excludes done rows and sorts by key", () => {
		const t = table([
			["c", "a2"],
			["a", "a0"],
			["b", "a1"],
			["d", "a3", { doneAt: 5 }],
		])
		expect(queueOf(t).map(([id]) => id)).toEqual(["a", "b", "c"])
		expect(historyOf(t).map(([id]) => id)).toEqual(["d"])
	})
	test("keyForMove drops between neighbours; top and bottom work", () => {
		const t = table([
			["a", "a0"],
			["b", "a1"],
			["c", "a2"],
			["d", "a3"],
		])
		const q = queueOf(t)
		const toTop = keyForMove(q, 2, 0)
		expect(toTop < "a0").toBe(true)
		const toBottom = keyForMove(q, 0, 3)
		expect(toBottom > "a3").toBe(true)
		const middle = keyForMove(q, 3, 1)
		expect(middle > "a0" && middle < "a1").toBe(true)
		expect(keyForMove(q, 1, 1)).toBeNull()
	})
	test("totals and remaining", () => {
		const t = table([
			["a", "a0", { position: 100 }],
			["b", "a1"],
			["c", "a2"],
		])
		const q = queueOf(t)
		expect(totalSeconds(q.map(([, r]) => r))).toBe(1800)
		expect(remainingSeconds(q, "a")).toBe(1700)
		expect(remainingSeconds(q, "b")).toBe(1200)
		expect(remainingSeconds(q, "missing")).toBe(1800)
	})
})

describe("now, next, later", () => {
	const t = table([
		["now", "a0"],
		["b", "a1"],
		["c", "a2"],
		["d", "a3"],
	])
	const sorted = (rows) =>
		Object.entries(rows)
			.sort(([, x], [, y]) => (x.order < y.order ? -1 : 1))
			.map(([id]) => id)
	test("keyToFollow puts an episode right behind the current one", () => {
		const q = queueOf(t)
		const moved = { ...t, d: { ...t.d, order: keyToFollow(q, "now", "d") } }
		expect(sorted(moved)).toEqual(["now", "d", "b", "c"])
		const already = { ...t, b: { ...t.b, order: keyToFollow(q, "now", "b") } }
		expect(sorted(already)).toEqual(["now", "b", "c", "d"])
	})
	test("with nothing current, keyToFollow means the top", () => {
		const q = queueOf(t)
		const moved = { ...t, c: { ...t.c, order: keyToFollow(q, "", "c") } }
		expect(sorted(moved)[0]).toBe("c")
	})
	test("nextUp is the episode below the current one, and nothing past the end", () => {
		const q = queueOf(t)
		expect(nextUp(q, "now")).toBe("b")
		expect(nextUp(q, "c")).toBe("d")
		expect(nextUp(q, "d")).toBe("")
		expect(nextUp(q, "")).toBe("now")
		expect(nextUp([], "now")).toBe("")
		const broken = queueOf({ ...t, b: { ...t.b, error: "This video is DRM protected" } })
		expect(nextUp(broken, "now")).toBe("c")
	})
	test("previousOf is the episode above, and nothing at the top", () => {
		const q = queueOf(t)
		expect(previousOf(q, "c")).toBe("b")
		expect(previousOf(q, "now")).toBe("")
		expect(previousOf(q, "")).toBe("")
	})
})
