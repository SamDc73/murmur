import { format } from "date-fns/format"
import { isThisYear } from "date-fns/isThisYear"
import { isToday } from "date-fns/isToday"
import { isYesterday } from "date-fns/isYesterday"
import { parse } from "date-fns/parse"
import prettyBytes from "pretty-bytes"

// Every figure the UI shows, in one place. Mono type expects these shapes.
// Dates are date-fns's, sizes pretty-bytes's; the two duration shapes below
// are ours because no library prints exactly these.

/** 5025 → "1:23:45", 305 → "5:05", 0 → "0:00" — a clock, as players show it. */
export function clock(seconds) {
	const total = Math.max(0, Math.floor(Number(seconds) || 0))
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = String(total % 60).padStart(2, "0")
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`
}

/** 51600 → "14 h 20 m", 2880 → "48 m", 10800 → "3 h", 30 → "under a minute" */
export function hours(seconds) {
	const total = Math.max(0, Math.round(Number(seconds) || 0))
	if (total < 60) return total === 0 ? "0 m" : "under a minute"
	const h = Math.floor(total / 3600)
	const m = Math.round((total % 3600) / 60)
	return [h && `${h} h`, m && `${m} m`].filter(Boolean).join(" ")
}

export function bytes(count) {
	return prettyBytes(Number(count) || 0)
}

/** "Today", "Yesterday", else "Mon 22 Sept" (with the year when it differs). */
export function dayLabel(ms, now = Date.now()) {
	if (isToday(ms)) return "Today"
	if (isYesterday(ms)) return "Yesterday"
	return format(
		ms,
		isThisYear(ms) && new Date(now).getFullYear() === new Date(ms).getFullYear() ? "EEE d MMM" : "EEE d MMM yyyy"
	)
}

/** 1759430520000 → "1:42 PM" — the time of day, in the reader's locale. */
export function timeOfDay(ms) {
	return format(ms, "p")
}

/** yt-dlp's upload_date "20250917" → "17 Sep 2025" */
export function uploadDate(yyyymmdd) {
	if (!/^\d{8}$/.test(String(yyyymmdd ?? ""))) return ""
	return format(parse(yyyymmdd, "yyyyMMdd", new Date()), "d MMM yyyy")
}
