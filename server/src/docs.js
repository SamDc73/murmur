import { extractLinks } from "@murmur/core"

// Reading a Google Doc for its YouTube links. The doc comes as HTML (plain
// text would drop a link hidden behind words); Bun's HTMLRewriter collects
// every link and every run of text, and the same link finder as a paste picks
// out the videos and playlists.

const NOT_SHARED = "Couldn’t open that doc. Share it as “Anyone with the link”."

/** @returns {Promise<Array<{ url: string, videoId: string, playlistId: string, start: number }>>} */
export async function readDoc(docUrl, fetchDoc = fetch) {
	const response = await fetchDoc(docUrl, { redirect: "follow" })
	// A private doc answers with Google's sign-in page, not an error.
	if (!response.ok || new URL(response.url || docUrl).hostname !== "docs.google.com") throw new Error(NOT_SHARED)
	const found = []
	await new HTMLRewriter()
		.on("a[href]", { element: (a) => found.push(unwrap(a.getAttribute("href"))) })
		.onDocument({ text: (chunk) => found.push(chunk.text) })
		.transform(response)
		.text()
	return extractLinks(found.join(" ")).filter((link) => link.videoId || link.playlistId)
}

// Google routes every link in an exported doc through
// https://www.google.com/url?q=<the link>&sa=…
function unwrap(href) {
	try {
		const url = new URL(href)
		if (url.hostname.endsWith("google.com") && url.pathname === "/url") return url.searchParams.get("q") ?? href
	} catch {
		// not an absolute URL: keep it as it is
	}
	return href
}
