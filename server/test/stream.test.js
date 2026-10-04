import { describe, expect, test } from "bun:test"
import { newItem, TABLES, VALUES } from "@murmur/core"
import { createMergeableStore } from "tinybase"
import { rewrite, stream, trimMaster } from "../src/stream.js"

// A master playlist as YouTube writes one (shortened): two audio groups, a
// dozen dubs and the original, H.264 and VP9 variants from 240p to 1080p.
const MANIFEST = "https://manifest.googlevideo.com/api/manifest/hls_playlist"
const MASTER = [
	"#EXTM3U",
	"#EXT-X-INDEPENDENT-SEGMENTS",
	`#EXT-X-MEDIA:URI="${MANIFEST}/a233-en",TYPE=AUDIO,GROUP-ID="233",LANGUAGE="en-US",NAME="American English - original",DEFAULT=YES,AUTOSELECT=YES`,
	`#EXT-X-MEDIA:URI="${MANIFEST}/a234-de",TYPE=AUDIO,GROUP-ID="234",LANGUAGE="de-DE",NAME="Deutsch (Deutschland) - dubbed-auto",DEFAULT=NO,AUTOSELECT=YES`,
	`#EXT-X-MEDIA:URI="${MANIFEST}/a234-en",TYPE=AUDIO,GROUP-ID="234",LANGUAGE="en-US",NAME="American English - original",DEFAULT=NO,AUTOSELECT=YES`,
	`#EXT-X-STREAM-INF:BANDWIDTH=132057,CODECS="avc1.4D4015,mp4a.40.5",RESOLUTION=426x240,AUDIO="233"`,
	`${MANIFEST}/v240-233`,
	`#EXT-X-STREAM-INF:BANDWIDTH=279909,CODECS="avc1.4D401E,mp4a.40.2",RESOLUTION=640x360,AUDIO="234"`,
	`${MANIFEST}/v360`,
	`#EXT-X-STREAM-INF:BANDWIDTH=528395,CODECS="avc1.4D401F,mp4a.40.2",RESOLUTION=1280x720,AUDIO="234"`,
	`${MANIFEST}/v720`,
	`#EXT-X-STREAM-INF:BANDWIDTH=1869823,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080,AUDIO="234"`,
	`${MANIFEST}/v1080`,
	`#EXT-X-STREAM-INF:BANDWIDTH=1069081,CODECS="vp09.00.31.08,mp4a.40.2",RESOLUTION=1280x720,AUDIO="234"`,
	`${MANIFEST}/v720-vp9`,
	"",
].join("\n")

const SEGMENT = "https://rr4---sn-2on4v5-5a.googlevideo.com/videoplayback/itag/232/sq/1"
const MEDIA = ["#EXTM3U", "#EXT-X-PLAYLIST-TYPE:VOD", "#EXTINF:6.0,", SEGMENT, "#EXT-X-ENDLIST", ""].join("\n")

describe("trimMaster", () => {
	test("H.264 up to the height, the original audio only, as the default", () => {
		const trimmed = trimMaster(MASTER, 720)
		expect(trimmed).toContain(`${MANIFEST}/v360`)
		expect(trimmed).toContain(`${MANIFEST}/v720`)
		expect(trimmed).not.toContain("v1080")
		expect(trimmed).not.toContain("vp9")
		expect(trimmed).not.toContain("v240-233")
		const audio = trimmed.split("\n").filter((line) => line.startsWith("#EXT-X-MEDIA"))
		expect(audio.length).toBe(1)
		expect(audio[0]).toContain("a234-en")
		expect(audio[0]).toContain("DEFAULT=YES")
	})

	test("nothing small enough: the smallest there is", () => {
		const trimmed = trimMaster(MASTER, 144)
		expect(trimmed).toContain(`${MANIFEST}/v360`)
		expect(trimmed).not.toContain("v720")
	})
})

test("rewrite sends every address, lines and URI attributes, through the hop", () => {
	const out = rewrite(trimMaster(MASTER, 720), (uri) => `hop:${uri.split("/").pop()}`)
	expect(out).toContain('URI="hop:a234-en"')
	expect(out.split("\n").filter((line) => line.startsWith("hop:"))).toEqual(["hop:v360", "hop:v720"])
})

describe("the relay", () => {
	function setup() {
		const store = createMergeableStore("t")
		store.setRow(TABLES.items, "one", {
			...newItem({ url: "https://youtu.be/x", videoId: "x", order: "a0", addedAt: 1 }),
		})
		const fetched = []
		const fetchUpstream = async (url, init) => {
			fetched.push({ url: String(url), range: init?.headers?.range })
			const href = String(url)
			if (href === `${MANIFEST}/master`) return new Response(MASTER)
			if (href.startsWith(MANIFEST)) return new Response(MEDIA)
			return new Response("segment-bytes", {
				status: 206,
				headers: { "content-type": "video/mp2t", "content-range": "bytes 0-12/13" },
			})
		}
		const app = stream(store, { manifestOf: async () => `${MANIFEST}/master`, fetchUpstream })
		return { store, app, fetched }
	}
	const hopOf = (text) => text.split("\n").find((line) => line.startsWith("hop?u="))

	test("master → media playlist → segment, every step through the server, the password along", async () => {
		const { app, fetched } = setup()
		const master = await app.request("/one/index.m3u8?token=secret")
		expect(master.headers.get("content-type")).toBe("application/vnd.apple.mpegurl")
		const variant = hopOf(await master.text())
		expect(variant).toContain("&token=secret")
		const media = await app.request(`/one/${variant}`)
		const segment = hopOf(await media.text())
		const bytes = await app.request(`/one/${segment}`, { headers: { range: "bytes=0-12" } })
		expect(bytes.status).toBe(206)
		expect(await bytes.text()).toBe("segment-bytes")
		expect(bytes.headers.get("content-range")).toBe("bytes 0-12/13")
		expect(fetched.at(-1)).toEqual({ url: SEGMENT, range: "bytes=0-12" })
	})

	test("follows the Video setting", async () => {
		const { store, app } = setup()
		store.setValue(VALUES.videoHeight, 1080)
		expect(await (await app.request("/one/index.m3u8")).text()).toContain("hop?u=")
		const lines = (await (await app.request("/one/index.m3u8")).text())
			.split("\n")
			.filter((l) => l.startsWith("hop?u="))
		expect(lines.length).toBe(3)
	})

	test("the episode that's playing is looked up ahead, once", async () => {
		const store = createMergeableStore("t")
		store.setRow(TABLES.items, "one", {
			...newItem({ url: "https://youtu.be/x", videoId: "x", order: "a0", addedAt: 1 }),
		})
		let lookups = 0
		const app = stream(store, {
			manifestOf: async () => {
				lookups++
				return `${MANIFEST}/master`
			},
			fetchUpstream: async () => new Response(MASTER),
		})
		store.setValue(VALUES.currentItemId, "one")
		expect(lookups).toBe(1)
		await app.request("/one/index.m3u8")
		expect(lookups).toBe(1)
	})

	test("relays YouTube only, and only for episodes it has", async () => {
		const { app } = setup()
		const elsewhere = Buffer.from("https://example.com/secret").toString("base64url")
		expect((await app.request(`/one/hop?u=${elsewhere}`)).status).toBe(400)
		expect((await app.request("/nope/index.m3u8")).status).toBe(404)
	})
})
