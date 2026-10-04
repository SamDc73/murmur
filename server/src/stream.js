import { setting, TABLES, VALUES } from "@murmur/core"
import { Hono } from "hono"

// Watching without waiting for a download: YouTube's own HLS stream, relayed.
// Its addresses only work from the server's IP, so every one of them — in the
// master playlist and in the playlists it points to — is rewritten to come
// back through here. Players seek in it like in a file.
//
//   GET /api/stream/:id/index.m3u8   the master playlist, trimmed to H.264 up
//                                    to the Video setting (720p if Off), with
//                                    the original-language audio only
//   GET /api/stream/:id/hop?u=…       a playlist or a segment, fetched for you

// YouTube's links last about six hours; ask again after one.
const MANIFEST_FOR_MS = 60 * 60 * 1000
const YOUTUBE = /(^|\.)(googlevideo|youtube)\.com$/
const PLAYLIST_TYPE = "application/vnd.apple.mpegurl"
const PASSED_ON = ["content-type", "content-length", "content-range", "accept-ranges"]

export function stream(store, { manifestOf, fetchUpstream = fetch }) {
	const app = new Hono()
	const manifests = new Map()

	// One lookup per episode at a time; a failed one isn't kept.
	function masterUrl(id, url) {
		const known = manifests.get(id)
		if (known && Date.now() - known.at < MANIFEST_FOR_MS) return known.found
		const found = manifestOf(url).catch(() => "")
		manifests.set(id, { found, at: Date.now() })
		found.then((value) => value || manifests.delete(id))
		return found
	}

	// Looked up ahead for the episode that's playing — yt-dlp takes a few
	// seconds — so Watch starts on the stream itself.
	const warm = (id) => {
		const url = id && store.getCell(TABLES.items, id, "url")
		if (url) masterUrl(id, url)
	}
	store.addValueListener(VALUES.currentItemId, (_store, _valueId, id) => warm(id))
	warm(setting(store.getValues(), VALUES.currentItemId))

	app.get("/:id/index.m3u8", async (c) => {
		const id = c.req.param("id")
		const row = store.getRow(TABLES.items, id)
		if (!row.url) return c.json({ error: "No such episode" }, 404)
		const master = await masterUrl(id, row.url)
		if (!master) return c.json({ error: "YouTube has no stream for this one" }, 404)
		const height = setting(store.getValues(), VALUES.videoHeight) || 720
		const text = await (await fetchUpstream(master)).text()
		return playlist(rewrite(trimMaster(text, height), hopFor(c)))
	})

	app.get("/:id/hop", async (c) => {
		const target = decode(c.req.query("u"))
		if (!target || !YOUTUBE.test(target.hostname)) return c.json({ error: "Not a YouTube address" }, 400)
		const range = c.req.header("range")
		const upstream = await fetchUpstream(target, { headers: range ? { range } : {} })
		// A media playlist: its segments come through here too.
		if (target.pathname.startsWith("/api/manifest/")) return playlist(rewrite(await upstream.text(), hopFor(c)))
		const headers = new Headers()
		for (const name of PASSED_ON) {
			const value = upstream.headers.get(name)
			if (value) headers.set(name, value)
		}
		return new Response(upstream.body, { status: upstream.status, headers })
	})

	return app
}

/**
 * The master playlist, trimmed: H.264 video up to `maxHeight` (the smallest
 * there is, if none fits), and of the audio only the original language —
 * YouTube offers a dozen machine dubs besides.
 */
export function trimMaster(text, maxHeight) {
	const lines = text.split("\n")
	const audio = lines.filter((line) => line.startsWith("#EXT-X-MEDIA") && line.includes("TYPE=AUDIO"))
	const group = audio.some((line) => line.includes('GROUP-ID="234"')) ? "234" : groupOf(audio[0] ?? "")
	const ours = audio.filter((line) => groupOf(line) === group)
	const original =
		ours.find((line) => /NAME="[^"]*original"/i.test(line)) ??
		ours.find((line) => line.includes("DEFAULT=YES")) ??
		ours[0]

	const variants = []
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].startsWith("#EXT-X-STREAM-INF")) variants.push({ info: lines[i], uri: lines[i + 1] })
	}
	const h264 = variants.filter((v) => /avc1/.test(v.info) && (!group || v.info.includes(`AUDIO="${group}"`)))
	const fitting = h264.filter((v) => heightOf(v.info) <= maxHeight)
	const kept = fitting.length > 0 ? fitting : h264.sort((a, b) => heightOf(a.info) - heightOf(b.info)).slice(0, 1)

	const head = lines.filter(
		(line) => line.startsWith("#") && !line.startsWith("#EXT-X-MEDIA") && !line.startsWith("#EXT-X-STREAM-INF")
	)
	const media = original ? [original.replace("DEFAULT=NO", "DEFAULT=YES")] : []
	return [...head, ...media, ...kept.flatMap((v) => [v.info, v.uri]), ""].join("\n")
}

/** Every address in a playlist — its own lines and URI="…" attributes — through `hop`. */
export function rewrite(text, hop) {
	return text
		.split("\n")
		.map((line) => {
			if (line.startsWith("#")) return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${hop(uri)}"`)
			return line.trim() === "" ? line : hop(line.trim())
		})
		.join("\n")
}

// A hop is relative ("hop?u=…"), so it resolves next to whichever playlist it
// is in; the password rides along, as players can't add it themselves.
function hopFor(c) {
	const token = c.req.query("token")
	return (uri) => `hop?u=${Buffer.from(uri).toString("base64url")}${token ? `&token=${encodeURIComponent(token)}` : ""}`
}

function decode(value) {
	try {
		return new URL(Buffer.from(value ?? "", "base64url").toString())
	} catch {
		return null
	}
}

function playlist(text) {
	return new Response(text, { headers: { "content-type": PLAYLIST_TYPE, "cache-control": "no-store" } })
}

const groupOf = (line) => /GROUP-ID="([^"]+)"/.exec(line)?.[1] ?? ""
const heightOf = (info) => Number(/RESOLUTION=\d+x(\d+)/.exec(info)?.[1] ?? 0)
