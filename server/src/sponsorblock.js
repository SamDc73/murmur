import { createHash } from "node:crypto"
import { normaliseSponsorSegments } from "@murmur/core"

const API_ROOT = "https://sponsor.ajay.app/api/skipSegments"
const TIMEOUT_MS = 10_000

/** Sponsor ranges for one YouTube video, using SponsorBlock's k-anonymity API. */
export async function fetchSponsorSegments(videoId, fetcher = fetch) {
	// SponsorBlock sees a hash prefix shared by several videos, not the video id.
	const prefix = createHash("sha256").update(videoId).digest("hex").slice(0, 4)
	const url = new URL(`${API_ROOT}/${prefix}`)
	url.searchParams.set("categories", JSON.stringify(["sponsor"]))
	url.searchParams.set("actionTypes", JSON.stringify(["skip"]))
	const response = await fetcher(url, {
		headers: { "User-Agent": "Murmur/0.1 (+https://github.com/SamDc73/murmur)" },
		signal: AbortSignal.timeout(TIMEOUT_MS),
	})
	// A 404 is the API's ordinary answer when there are no matching submissions.
	if (response.status === 404) return []
	if (!response.ok) throw new Error(`SponsorBlock returned HTTP ${response.status}`)
	const matches = await response.json()
	const match = Array.isArray(matches) ? matches.find((entry) => entry.videoID === videoId) : null
	return normaliseSponsorSegments(match?.segments ?? [])
}
