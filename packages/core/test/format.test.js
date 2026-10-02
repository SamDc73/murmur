import { describe, expect, test } from "bun:test"
import { bytes, clock, dayLabel, hours, timeOfDay, uploadDate } from "../src/format.js"

describe("format", () => {
	test("clock", () => {
		expect(clock(0)).toBe("0:00")
		expect(clock(305)).toBe("5:05")
		expect(clock(5025)).toBe("1:23:45")
		expect(clock(3600)).toBe("1:00:00")
		expect(clock(-4)).toBe("0:00")
	})
	test("hours", () => {
		expect(hours(51600)).toBe("14 h 20 m")
		expect(hours(2880)).toBe("48 m")
		expect(hours(10800)).toBe("3 h")
		expect(hours(30)).toBe("under a minute")
		expect(hours(0)).toBe("0 m")
	})
	test("bytes", () => {
		expect(bytes(512)).toBe("512 B")
		expect(bytes(52_428_800)).toBe("52.4 MB")
		expect(bytes(0)).toBe("0 B")
	})
	test("dayLabel", () => {
		const now = Date.now()
		expect(dayLabel(now, now)).toBe("Today")
		expect(dayLabel(now - 86_400_000, now)).toBe("Yesterday")
		expect(dayLabel(new Date(2024, 0, 3).getTime(), now)).toBe("Wed 3 Jan 2024")
	})
	test("uploadDate", () => {
		expect(uploadDate("20250917")).toBe("17 Sep 2025")
		expect(uploadDate("")).toBe("")
	})

	test("timeOfDay is a short local time", () => {
		const afternoon = new Date(2026, 9, 2, 13, 42).getTime()
		expect(timeOfDay(afternoon)).toMatch(/^(1:42\s?PM|13:42)$/)
	})
})
