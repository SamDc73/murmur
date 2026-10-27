// SponsorBlock's API records become small { start, end } ranges for the store.
// The same helper also validates ranges read back from a row.
export function normaliseSponsorSegments(segments) {
	if (!Array.isArray(segments)) return []
	return segments
		.flatMap((entry) => {
			if (!entry || (entry.category !== undefined && entry.category !== "sponsor")) return []
			if (entry.actionType !== undefined && entry.actionType !== "skip") return []
			const range = Array.isArray(entry) ? entry : (entry.segment ?? [entry.start, entry.end])
			if (!Array.isArray(range)) return []
			const start = Number(range[0])
			const end = Number(range[1])
			if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return []
			return [{ start, end }]
		})
		.sort((a, b) => a.start - b.start || a.end - b.end)
}

export function parseSponsorSegments(item) {
	try {
		return normaliseSponsorSegments(JSON.parse(item.sponsorSegments || "[]"))
	} catch {
		return []
	}
}

/** Where to resume when `position` is in a sponsor, or 0 when it is not. */
export function sponsorEnd(segments, position) {
	let end = 0
	for (const segment of segments) {
		if (end === 0) {
			if (position >= segment.start && position < segment.end) end = segment.end
			continue
		}
		// One seek also clears overlapping and back-to-back submissions.
		if (segment.start > end) break
		end = Math.max(end, segment.end)
	}
	return end
}
