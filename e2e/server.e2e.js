import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { COPY_STATE, historyOf, parsePairLink, queueOf, TABLES, VALUES } from "@murmur/core"
import { connectPeer, DEAD, probeFile, SNOWBOARD, startServer, TEST_8K, waitFor, ZOO, ZOO_PLAYLIST } from "./harness.js"

// The server, end to end, through the two doors a client uses: the sync
// socket (as a phone) and HTTP. Real yt-dlp, real YouTube, real files.
// The tests are one story and run in order: each builds on the last.

setDefaultTimeout(240_000)

let server
let phone
let zooId
let snowboardId

beforeAll(async () => {
	server = await startServer({ port: 3790 })
	phone = await connectPeer(server)
})

afterAll(async () => {
	phone?.close()
	await server?.cleanup()
})

/** Wait for the server to finish probing: the row, resolved or failed. */
function probed(id) {
	return waitFor(
		() => {
			const row = phone.item(id)
			return (row.resolvedAt > 0 || row.error) && row
		},
		{ label: `item ${id} probed` }
	)
}

/** Wait for a copy to settle: ready or failed. */
function settled(id, device = "server") {
	return waitFor(
		() => {
			const copy = phone.copy(id, device)
			return (copy.state === COPY_STATE.ready || copy.state === COPY_STATE.error) && copy
		},
		{ label: `copy of ${id} on ${device}` }
	)
}

const filesOf = (id) =>
	Object.keys(server.files()).filter((name) => name.startsWith(`${id}.`) && !name.endsWith(".transcript.json"))
// Media is addressed by file name: /api/media/<itemId>.<ext>, from the copy row.
const mediaOf = (id) => `/api/media/${phone.copy(id).uri}`

describe("the door is locked", () => {
	test("health is public and says a token is wanted", async () => {
		const response = await fetch(`${server.url}/api/health`)
		expect(await response.json()).toEqual({ ok: true, locked: true })
	})

	test("the API and the media refuse a missing or wrong token", async () => {
		expect((await fetch(`${server.url}/api/info`)).status).toBe(401)
		expect((await fetch(`${server.url}/api/info`, { headers: { Authorization: "Bearer nope" } })).status).toBe(401)
		expect((await fetch(`${server.url}/api/media/anything.m4a`)).status).toBe(401)
		expect((await server.api("/api/info")).status).toBe(200)
	})

	test("the sync socket refuses a missing token", async () => {
		const socket = new WebSocket(`${server.url.replace(/^http/, "ws")}/sync`)
		const outcome = await new Promise((resolve) => {
			socket.onopen = () => resolve("open")
			socket.onerror = () => resolve("refused")
			socket.onclose = () => resolve("refused")
		})
		expect(outcome).toBe("refused")
	})

	test("the log prints a pairing link with the public URL and the token", () => {
		const link = server.log.match(/murmur:\/\/pair\?\S+/)?.[0]
		expect(parsePairLink(link)).toEqual({ serverUrl: server.url, token: server.token })
	})
})

describe("one link, all the way", () => {
	test("is resolved: title, channel, length, chapters, thumbnail, description, date", async () => {
		;[zooId] = phone.add(ZOO.url)
		const row = await probed(zooId)
		expect(row.error).toBe("")
		expect(row.title).toBe(ZOO.title)
		expect(row.channel).toBe("jawed")
		expect(row.duration).toBe(ZOO.seconds)
		expect(JSON.parse(row.chapters).map((chapter) => chapter.title)).toEqual(["Intro", "The cool thing", "End"])
		expect(row.thumbnail).toStartWith("https://i.ytimg.com/")
		expect(row.description.length).toBeGreaterThan(0)
		expect(row.uploadDate).toBe("20050424")
	})

	test("is downloaded as AAC audio, and the file on disk is what the copy row says", async () => {
		const copy = await settled(zooId)
		expect(copy.error).toBe("")
		expect(copy.kind).toBe("audio")
		expect(copy.uri).toBe(`${zooId}.m4a`)
		expect(copy.progress).toBe(1)
		expect(server.files()[copy.uri]).toBe(copy.bytes)
		const file = await probeFile(server.path(copy.uri))
		expect(file.audio).toBe("aac")
		expect(file.video).toBe("")
		expect(Math.abs(file.seconds - ZOO.seconds)).toBeLessThan(1.5)
	})

	test("is served the way players ask: whole, a range, the tail, out of bounds, HEAD", async () => {
		const size = phone.copy(zooId).bytes
		const disk = new Uint8Array(await Bun.file(server.path(`${zooId}.m4a`)).arrayBuffer())
		const media = (headers = {}, method = "GET") => server.api(mediaOf(zooId), { method, headers })

		const whole = await media()
		expect(whole.status).toBe(200)
		expect(whole.headers.get("content-type")).toBe("audio/mp4")
		expect((await whole.arrayBuffer()).byteLength).toBe(size)

		const first = await media({ Range: "bytes=0-99" })
		expect(first.status).toBe(206)
		expect(first.headers.get("content-range")).toBe(`bytes 0-99/${size}`)
		expect(new Uint8Array(await first.arrayBuffer())).toEqual(disk.slice(0, 100))

		const tail = await media({ Range: "bytes=-10" })
		expect(tail.status).toBe(206)
		expect(new Uint8Array(await tail.arrayBuffer())).toEqual(disk.slice(-10))

		expect((await media({ Range: `bytes=${size}-` })).status).toBe(416)

		const head = await media({}, "HEAD")
		expect(head.status).toBe(200)
		expect(head.headers.get("content-length")).toBe(String(size))
	})

	test("every range is exactly the bytes asked for, request after request on one connection", async () => {
		const disk = new Uint8Array(await Bun.file(server.path(`${zooId}.m4a`)).arrayBuffer())
		const size = disk.length
		// What a player does while you scrub: many ranges, back to back, kept alive.
		const ranges = [
			[0, 0],
			[0, 99],
			[size - 1, size - 1],
			[1000, 5000],
			[size - 4096, size - 1],
			[12_345, 12_345],
			[0, size - 1],
		]
		for (let round = 0; round < 3; round++) {
			for (const [start, end] of ranges) {
				const response = await server.api(mediaOf(zooId), { headers: { Range: `bytes=${start}-${end}` } })
				expect(response.status).toBe(206)
				expect(response.headers.get("content-length")).toBe(String(end - start + 1))
				expect(new Uint8Array(await response.arrayBuffer())).toEqual(disk.slice(start, end + 1))
			}
			await server.api(mediaOf(zooId), { method: "HEAD" })
		}
		// And on the wire itself: the declared length is the length sent.
		const socket = await Bun.connect({
			hostname: "127.0.0.1",
			port: server.port,
			socket: {
				data(s, chunk) {
					s.data.push(chunk)
				},
			},
			data: [],
		})
		socket.write(
			`GET ${mediaOf(zooId)}?token=${server.token} HTTP/1.1\r\nHost: x\r\nRange: bytes=0-3\r\nConnection: close\r\n\r\n`
		)
		await waitFor(() => socket.data.length > 0 && Buffer.concat(socket.data).includes("\r\n\r\n"), {
			timeout: 5000,
			label: "raw response",
		})
		await Bun.sleep(300)
		const raw = Buffer.concat(socket.data)
		const body = raw.subarray(raw.indexOf("\r\n\r\n") + 4)
		expect(body.length).toBe(4)
		socket.end()
	})

	test("an <audio> element can fetch it: token in the query, CORS open for Range", async () => {
		const viaQuery = await fetch(`${server.url}${mediaOf(zooId)}?token=${server.token}`, {
			headers: { Range: "bytes=0-0" },
		})
		expect(viaQuery.status).toBe(206)
		const preflight = await fetch(`${server.url}${mediaOf(zooId)}`, {
			method: "OPTIONS",
			headers: {
				Origin: "http://localhost:8081",
				"Access-Control-Request-Method": "GET",
				"Access-Control-Request-Headers": "range",
			},
		})
		expect(preflight.status).toBe(204)
		expect(preflight.headers.get("access-control-allow-headers")?.toLowerCase()).toContain("range")
		const cors = await fetch(`${server.url}${mediaOf(zooId)}?token=${server.token}`, {
			headers: { Origin: "http://localhost:8081", Range: "bytes=0-0" },
		})
		expect(cors.headers.get("access-control-allow-origin")).toBe("*")
		expect(cors.headers.get("access-control-expose-headers")).toContain("Content-Range")
	})
})

describe("its transcript", () => {
	test("is fetched from YouTube's captions and served beside the audio", async () => {
		await waitFor(() => phone.item(zooId).transcript === "en", { label: "transcript saved" })
		const response = await server.api(`/api/media/${zooId}.transcript.json`)
		expect(response.status).toBe(200)
		expect(response.headers.get("content-type")).toStartWith("application/json")
		const { lang, auto, cues } = await response.json()
		expect({ lang, auto }).toEqual({ lang: "en", auto: false })
		expect(cues[0].t).toContain("in front of the elephants")
		expect(cues.every((cue, i) => cue.e >= cue.s && (i === 0 || cue.s >= cues[i - 1].s))).toBe(true)
		expect((await fetch(`${server.url}/api/media/${zooId}.transcript.json`)).status).toBe(401)
	})
})

describe("more than one link", () => {
	test("a pasted list lands in order and every link is fetched", async () => {
		const ids = phone.add(SNOWBOARD.url, TEST_8K.url)
		snowboardId = ids[0]
		const rows = await Promise.all(ids.map(probed))
		expect(rows.map((row) => row.error)).toEqual(["", ""])
		expect(rows.map((row) => row.videoId)).toEqual([SNOWBOARD.id, TEST_8K.id])
		const queue = queueOf(phone.store.getTable(TABLES.items)).map(([id]) => id)
		expect(queue.slice(-2)).toEqual(ids)
		const copies = await Promise.all(ids.map((id) => settled(id)))
		expect(copies.map((copy) => copy.state)).toEqual([COPY_STATE.ready, COPY_STATE.ready])
	})

	test("a playlist link turns into its videos", async () => {
		const [id] = phone.add(ZOO_PLAYLIST)
		const row = await probed(id)
		expect(row.error).toBe("")
		expect(row.videoId).toBe(ZOO.id)
		expect(row.url).toBe(`https://www.youtube.com/watch?v=${ZOO.id}`)
		expect(row.title).toBe(ZOO.title)
		phone.store.delRow(TABLES.items, id)
		await waitFor(() => filesOf(id).length === 0 && !phone.store.hasRow(TABLES.copies, `${id}:server`), {
			label: "playlist item cleaned up",
		})
	})

	test("a dead link fails with YouTube's own reason, and Try again really tries again", async () => {
		const [id] = phone.add(DEAD)
		const row = await probed(id)
		expect(row.error).toMatch(/unavailable/i)
		expect(phone.store.hasRow(TABLES.copies, `${id}:server`)).toBe(false)
		const probes = () =>
			server.log.split("\n").filter((line) => line.includes("probe") && line.includes("aaaaaaaaaaa")).length
		expect(probes()).toBe(1)
		phone.store.setPartialRow(TABLES.items, id, { error: "", resolvedAt: 0 })
		await waitFor(() => probes() === 2 && phone.item(id).error, { label: "second probe" })
		expect(phone.item(id).error).toMatch(/unavailable/i)
		phone.store.delRow(TABLES.items, id)
	})
})

describe("the settings the server obeys", () => {
	test("audio format opus: new downloads are Opus", async () => {
		phone.store.setValue(VALUES.audioFormat, "opus")
		const [id] = phone.add(SNOWBOARD.url)
		const copy = await settled(id)
		expect(copy.uri).toBe(`${id}.opus`)
		expect((await server.api(mediaOf(id), { method: "HEAD" })).headers.get("content-type")).toBe("audio/opus")
		expect((await probeFile(server.path(copy.uri))).audio).toBe("opus")
		phone.store.setValue(VALUES.audioFormat, "m4a")
		phone.store.delRow(TABLES.items, id)
	})

	test("video on request swaps the audio for an mp4, and back again", async () => {
		phone.store.setCell(TABLES.items, zooId, "wantKind", "video")
		const video = await waitFor(() => {
			const copy = phone.copy(zooId)
			return copy.kind === "video" && copy.state === COPY_STATE.ready && copy
		})
		expect(video.uri).toBe(`${zooId}.mp4`)
		expect(filesOf(zooId)).toEqual([`${zooId}.mp4`])
		expect((await server.api(mediaOf(zooId), { method: "HEAD" })).headers.get("content-type")).toBe("video/mp4")
		const file = await probeFile(server.path(video.uri))
		expect(file.video).not.toBe("")
		expect(file.audio).not.toBe("")
		expect(file.height).toBeGreaterThan(0)
		expect(file.height).toBeLessThanOrEqual(720)

		phone.store.setCell(TABLES.items, zooId, "wantKind", "audio")
		await waitFor(() => phone.copy(zooId).kind === "audio" && phone.copy(zooId).state === COPY_STATE.ready)
		expect(filesOf(zooId)).toEqual([`${zooId}.m4a`])
		expect(server.files()[`${zooId}.transcript.json`]).toBeGreaterThan(0) // swapping the media keeps it
	})

	test("video for everything: new items arrive as video no taller than the setting", async () => {
		phone.store.setValue(VALUES.videoHeight, 480)
		const [id] = phone.add(ZOO.url)
		const copy = await settled(id)
		expect(copy.kind).toBe("video")
		const file = await probeFile(server.path(copy.uri))
		expect(file.height).toBeGreaterThan(0)
		expect(file.height).toBeLessThanOrEqual(480)
		phone.store.setValue(VALUES.videoHeight, 0)
		phone.store.delRow(TABLES.items, id)
	})

	test("keep on server off: once a phone holds the file the server lets go, and fetches it back when switched on", async () => {
		phone.store.setRow(TABLES.devices, "pixel", { name: "Pixel", kind: "phone", lastSeen: Date.now() })
		phone.store.setRow(TABLES.copies, `${snowboardId}:pixel`, {
			itemId: snowboardId,
			deviceId: "pixel",
			kind: "audio",
			state: COPY_STATE.ready,
			progress: 1,
			bytes: 1,
			uri: "file:///phone/copy.m4a",
			error: "",
			updatedAt: Date.now(),
		})
		const snowboardFile = mediaOf(snowboardId)
		phone.store.setValue(VALUES.keepOnServer, false)
		await waitFor(() => phone.copy(snowboardId).state === COPY_STATE.evicted, { label: "eviction" })
		expect(filesOf(snowboardId)).toEqual([])
		expect((await server.api(snowboardFile)).status).toBe(404)
		// Items no phone holds keep their file.
		expect(phone.copy(zooId).state).toBe(COPY_STATE.ready)

		phone.store.setValue(VALUES.keepOnServer, true)
		await waitFor(() => phone.copy(snowboardId).state === COPY_STATE.ready, { label: "fetched back" })
		expect(filesOf(snowboardId).length).toBe(1)
	})
})

describe("devices agree", () => {
	test("a second device sees positions and finished episodes from the first", async () => {
		const laptop = await connectPeer(server)
		try {
			phone.store.setCell(TABLES.items, zooId, "position", 7)
			await waitFor(() => laptop.item(zooId).position === 7, { label: "position on the laptop" })
			phone.store.setCell(TABLES.items, zooId, "doneAt", Date.now())
			await waitFor(() => historyOf(laptop.store.getTable(TABLES.items)).some(([id]) => id === zooId), {
				label: "history on the laptop",
			})
			laptop.store.setPartialRow(TABLES.items, zooId, { doneAt: 0, position: 0 })
			await waitFor(() => phone.item(zooId).doneAt === 0, { label: "back in the queue on the phone" })
		} finally {
			laptop.close()
		}
	})

	test("removing an episode deletes its file and every device's copy row", async () => {
		const file = mediaOf(snowboardId)
		phone.store.delRow(TABLES.items, snowboardId)
		await waitFor(
			() =>
				filesOf(snowboardId).length === 0 &&
				phone.store.getRowIds(TABLES.copies).every((cid) => !cid.startsWith(snowboardId)),
			{ label: "snowboard cleaned up" }
		)
		expect((await server.api(file)).status).toBe(404)
	})

	test("removing an episode mid-download leaves nothing behind", async () => {
		const [id] = phone.add("https://youtu.be/dQw4w9WgXcQ")
		await waitFor(() => phone.copy(id).state === COPY_STATE.downloading, { label: "download started" })
		phone.store.delRow(TABLES.items, id)
		// yt-dlp finishes the file it was writing; then the server drops it.
		await waitFor(() => server.log.includes(`dropped ${id}`), { timeout: 120_000, label: "download dropped" })
		await waitFor(() => !phone.store.hasRow(TABLES.copies, `${id}:server`), { label: "copy row gone" })
		expect(phone.store.hasRow(TABLES.items, id)).toBe(false)
		expect(filesOf(id)).toEqual([])
	})
})

describe("a restart", () => {
	test("keeps the queue and the files, and fetches nothing again", async () => {
		const before = queueOf(phone.store.getTable(TABLES.items)).map(([id]) => id)
		const files = server.files()
		phone.close()
		await server.stop()
		await server.start()
		phone = await connectPeer(server)
		await waitFor(() => phone.store.getRowCount(TABLES.items) >= before.length, { label: "queue after restart" })
		expect(queueOf(phone.store.getTable(TABLES.items)).map(([id]) => id)).toEqual(before)
		expect(server.files()).toEqual(files)
		expect((await server.api(mediaOf(zooId), { headers: { Range: "bytes=0-9" } })).status).toBe(206)
		await Bun.sleep(3000)
		expect(server.log).not.toMatch(/\[pipeline\] (probe|download)/)
	})
})
