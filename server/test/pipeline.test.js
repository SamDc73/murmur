import { describe, expect, test } from "bun:test"
import { COPY_STATE, copyId, DEVICE_SERVER, keyAfter, newItem, TABLES, VALUES } from "@murmur/core"
import { createMergeableStore } from "tinybase"
import { createPipeline } from "../src/pipeline.js"

const quiet = {
	info() {
		// silent in tests
	},
	error() {
		// silent in tests
	},
	warn() {
		// silent in tests
	},
}
const config = { probeConcurrency: 2, downloadConcurrency: 1, deviceName: "Test" }

function fakeTools(overrides = {}) {
	const files = new Set()
	return {
		files,
		probe: async () => ({ id: "dQw4w9WgXcQ", title: "Hello", duration: 100, channel: "Ch" }),
		download: async (item, onProgress) => {
			onProgress({ downloaded: 50, total: 100 })
			const name = `${item.itemId}.${item.kind === "video" ? "mp4" : "m4a"}`
			files.add(name)
			return `/tmp/${name}`
		},
		listFiles: () => [...files],
		removeFile: (name) => files.delete(name),
		...overrides,
	}
}

function until(predicate, timeout = 2000) {
	return new Promise((resolve, reject) => {
		const started = Date.now()
		const timer = setInterval(() => {
			if (predicate()) {
				clearInterval(timer)
				resolve()
			} else if (Date.now() - started > timeout) {
				clearInterval(timer)
				reject(new Error("timed out"))
			}
		}, 10)
	})
}

// statSync is used for the final size; point it at a real file.
import { writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

function realTmpTools() {
	const tools = fakeTools()
	tools.download = async (item, onProgress) => {
		onProgress({ downloaded: 1, total: 2 })
		const path = join(tmpdir(), `murmur-test-${item.itemId}.${item.kind === "video" ? "mp4" : "m4a"}`)
		writeFileSync(path, "abc")
		tools.files.add(`${item.itemId}.m4a`)
		return path
	}
	return tools
}

describe("pipeline", () => {
	test("a pasted row gets resolved, then downloaded, in order", async () => {
		const store = createMergeableStore("t")
		const tools = realTmpTools()
		const pipeline = createPipeline({ store, config, tools, log: quiet })
		pipeline.start()
		const a = keyAfter(null)
		store.setRow(
			TABLES.items,
			"one",
			newItem({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", videoId: "dQw4w9WgXcQ", order: a, addedAt: 1 })
		)
		await until(() => store.getCell(TABLES.items, "one", "resolvedAt") > 0)
		expect(store.getCell(TABLES.items, "one", "title")).toBe("Hello")
		await until(() => store.getCell(TABLES.copies, copyId("one", DEVICE_SERVER), "state") === COPY_STATE.ready)
		const copy = store.getRow(TABLES.copies, copyId("one", DEVICE_SERVER))
		expect(copy.kind).toBe("audio")
		expect(copy.bytes).toBe(3)
		expect(copy.uri).toMatch(/\.m4a$/)
		expect(store.getRow(TABLES.devices, DEVICE_SERVER).kind).toBe("server")
		pipeline.stop()
	})

	test("a probe failure lands in the row, and nothing is downloaded", async () => {
		const store = createMergeableStore("t")
		const tools = fakeTools({
			probe: async () => {
				throw new Error("Video unavailable")
			},
		})
		const pipeline = createPipeline({ store, config, tools, log: quiet })
		pipeline.start()
		store.setRow(TABLES.items, "bad", newItem({ url: "u", videoId: "dQw4w9WgXcQ", order: "a0", addedAt: 1 }))
		await until(() => store.getCell(TABLES.items, "bad", "error") !== "")
		expect(store.getCell(TABLES.items, "bad", "error")).toBe("Video unavailable")
		await new Promise((r) => setTimeout(r, 300))
		expect(store.hasRow(TABLES.copies, copyId("bad", DEVICE_SERVER))).toBe(false)
		pipeline.stop()
	})

	test("a playlist expands: first entry replaces the row, rest append after the queue", async () => {
		const store = createMergeableStore("t")
		let calls = 0
		const tools = fakeTools({
			probe: async (url) => {
				calls++
				if (url.includes("playlist")) {
					return {
						// biome-ignore lint/style/useNamingConvention: yt-dlp field
						_type: "playlist",
						entries: [
							{ id: "AAAAAAAAAAA", title: "A" },
							{ id: "BBBBBBBBBBB", title: "B" },
							{ id: "CCCCCCCCCCC", title: "C" },
						],
					}
				}
				const id = new URL(url).searchParams.get("v")
				return { id, title: `full ${id}`, duration: 10 }
			},
		})
		const pipeline = createPipeline({ store, config: { ...config, downloadConcurrency: 0 }, tools, log: quiet })
		pipeline.start()
		store.setRow(TABLES.items, "existing", {
			...newItem({ url: "x", videoId: "XXXXXXXXXXX", order: "a0", addedAt: 1 }),
			resolvedAt: 5,
		})
		store.setRow(
			TABLES.items,
			"list",
			newItem({ url: "https://www.youtube.com/playlist?list=PLxxxxxxxxxxxx", videoId: "", order: "a1", addedAt: 2 })
		)
		await until(() => Object.values(store.getTable(TABLES.items)).filter((r) => r.resolvedAt > 0).length === 4, 4000)
		const rows = Object.entries(store.getTable(TABLES.items)).sort(([, a], [, b]) => (a.order < b.order ? -1 : 1))
		expect(rows.map(([, r]) => r.videoId)).toEqual(["XXXXXXXXXXX", "AAAAAAAAAAA", "BBBBBBBBBBB", "CCCCCCCCCCC"])
		expect(rows[1][0]).toBe("list")
		expect(rows[1][1].title).toBe("full AAAAAAAAAAA")
		expect(calls).toBe(4)
		pipeline.stop()
	})

	test("keepOnServer off: server evicts once a phone copy is ready; removal deletes files", async () => {
		const store = createMergeableStore("t")
		const tools = realTmpTools()
		const pipeline = createPipeline({ store, config, tools, log: quiet })
		pipeline.start()
		store.setValue(VALUES.keepOnServer, false)
		store.setRow(TABLES.items, "one", {
			...newItem({ url: "u", videoId: "dQw4w9WgXcQ", order: "a0", addedAt: 1 }),
			resolvedAt: 1,
		})
		await until(() => store.getCell(TABLES.copies, copyId("one", DEVICE_SERVER), "state") === COPY_STATE.ready)
		expect(tools.files.size).toBe(1)
		store.setRow(TABLES.copies, copyId("one", "pixel"), {
			itemId: "one",
			deviceId: "pixel",
			kind: "audio",
			state: COPY_STATE.ready,
			progress: 1,
			bytes: 3,
			uri: "file://x",
			error: "",
			updatedAt: 1,
		})
		await until(() => store.getCell(TABLES.copies, copyId("one", DEVICE_SERVER), "state") === COPY_STATE.evicted)
		expect(tools.files.size).toBe(0)
		// Keep again: the server fetches it back.
		store.setValue(VALUES.keepOnServer, true)
		await until(() => store.getCell(TABLES.copies, copyId("one", DEVICE_SERVER), "state") === COPY_STATE.ready)
		expect(tools.files.size).toBe(1)
		// Remove the item: file and every copy row go.
		store.delRow(TABLES.items, "one")
		await until(() => store.getRowIds(TABLES.copies).length === 0)
		expect(tools.files.size).toBe(0)
		pipeline.stop()
	})
})

describe("removal mid-job", () => {
	test("removing an item while it downloads leaves no ghost row, copy row or file", async () => {
		const store = createMergeableStore("t")
		const tools = fakeTools()
		let finish
		tools.download = (item) =>
			new Promise((resolve) => {
				finish = () => {
					const path = join(tmpdir(), `murmur-test-${item.itemId}.m4a`)
					writeFileSync(path, "abc")
					tools.files.add(`${item.itemId}.m4a`)
					resolve(path)
				}
			})
		const pipeline = createPipeline({ store, config, tools, log: quiet })
		pipeline.start()
		store.setRow(TABLES.items, "one", {
			...newItem({ url: "u", videoId: "dQw4w9WgXcQ", order: "a0", addedAt: 1 }),
			resolvedAt: 1,
		})
		await until(() => store.getCell(TABLES.copies, copyId("one", DEVICE_SERVER), "state") === COPY_STATE.downloading)
		store.delRow(TABLES.items, "one")
		await until(() => !store.hasRow(TABLES.copies, copyId("one", DEVICE_SERVER)))
		finish()
		await new Promise((r) => setTimeout(r, 300))
		expect(store.hasRow(TABLES.items, "one")).toBe(false)
		expect(store.getRowIds(TABLES.copies)).toEqual([])
		expect(tools.files.size).toBe(0)
		pipeline.stop()
	})

	test("removing an item while it is probed does not bring it back", async () => {
		const store = createMergeableStore("t")
		let answer
		const tools = fakeTools({ probe: () => new Promise((resolve) => (answer = resolve)) })
		const pipeline = createPipeline({ store, config, tools, log: quiet })
		pipeline.start()
		store.setRow(TABLES.items, "one", newItem({ url: "u", videoId: "dQw4w9WgXcQ", order: "a0", addedAt: 1 }))
		await until(() => typeof answer === "function")
		store.delRow(TABLES.items, "one")
		answer({ id: "dQw4w9WgXcQ", title: "late", duration: 5 })
		await new Promise((r) => setTimeout(r, 300))
		expect(store.hasRow(TABLES.items, "one")).toBe(false)
		pipeline.stop()
	})
})

test("an item played before its details arrived still gets them, and is not downloaded", async () => {
	const store = createMergeableStore("t")
	const tools = realTmpTools()
	const pipeline = createPipeline({ store, config, tools, log: quiet })
	pipeline.start()
	store.setRow(TABLES.items, "early", {
		...newItem({ url: "u", videoId: "dQw4w9WgXcQ", order: "a0", addedAt: 1 }),
		doneAt: 5,
	})
	await until(() => store.getCell(TABLES.items, "early", "resolvedAt") > 0)
	expect(store.getCell(TABLES.items, "early", "title")).toBe("Hello")
	await new Promise((r) => setTimeout(r, 300))
	expect(store.hasRow(TABLES.copies, copyId("early", DEVICE_SERVER))).toBe(false)
	pipeline.stop()
})

describe("transcripts", () => {
	const withCaptions = async () => ({
		id: "dQw4w9WgXcQ",
		title: "Hello",
		duration: 100,
		subtitles: { en: [{ ext: "json3" }] },
	})

	test("a probed item with captions gets its transcript once, beside its download", async () => {
		const store = createMergeableStore("t")
		const tools = realTmpTools()
		tools.probe = withCaptions
		let calls = 0
		tools.transcript = async (item) => {
			calls++
			expect(item).toMatchObject({ lang: "en", auto: false, itemId: "one" })
			tools.files.add("one.transcript.json")
			return 3
		}
		const pipeline = createPipeline({ store, config, tools, log: quiet })
		pipeline.start()
		store.setRow(TABLES.items, "one", newItem({ url: "u", videoId: "dQw4w9WgXcQ", order: "a0", addedAt: 1 }))
		await until(() => store.getCell(TABLES.items, "one", "transcript") === "en")
		await until(() => store.getCell(TABLES.copies, copyId("one", DEVICE_SERVER), "state") === COPY_STATE.ready)
		await new Promise((r) => setTimeout(r, 300))
		expect(calls).toBe(1)
		expect(tools.files.has("one.transcript.json")).toBe(true)
		pipeline.stop()
	})

	test("a transcript that cannot be fetched is tried once, and the audio still arrives", async () => {
		const store = createMergeableStore("t")
		const tools = realTmpTools()
		tools.probe = withCaptions
		let calls = 0
		tools.transcript = async () => {
			calls++
			throw new Error("HTTP 429")
		}
		const pipeline = createPipeline({ store, config, tools, log: quiet })
		pipeline.start()
		store.setRow(TABLES.items, "one", newItem({ url: "u", videoId: "dQw4w9WgXcQ", order: "a0", addedAt: 1 }))
		await until(() => store.getCell(TABLES.items, "one", "transcriptTried") > 0)
		await until(() => store.getCell(TABLES.copies, copyId("one", DEVICE_SERVER), "state") === COPY_STATE.ready)
		await new Promise((r) => setTimeout(r, 300))
		expect(calls).toBe(1)
		expect(store.getCell(TABLES.items, "one", "transcript")).toBe("")
		pipeline.stop()
	})

	test("an item probed before transcripts existed is probed again, once", async () => {
		const store = createMergeableStore("t")
		const tools = realTmpTools()
		let probes = 0
		tools.probe = async () => {
			probes++
			return { id: "dQw4w9WgXcQ", title: "Hello", duration: 100 }
		}
		const pipeline = createPipeline({ store, config, tools, log: quiet })
		const {
			captionLang: _a,
			captionAuto: _b,
			transcript: _c,
			transcriptTried: _d,
			...old
		} = newItem({ url: "u", videoId: "dQw4w9WgXcQ", order: "a0", addedAt: 1 })
		store.setRow(TABLES.items, "old", { ...old, resolvedAt: 1, title: "Hello" })
		pipeline.start()
		await until(() => store.getCell(TABLES.items, "old", "captionLang") !== undefined)
		await new Promise((r) => setTimeout(r, 300))
		expect(probes).toBe(1)
		expect(store.getCell(TABLES.items, "old", "captionLang")).toBe("")
		pipeline.stop()
	})

	test("swapping the media keeps the transcript; removing the item deletes it", async () => {
		const store = createMergeableStore("t")
		const tools = realTmpTools()
		tools.probe = withCaptions
		tools.transcript = async () => {
			tools.files.add("one.transcript.json")
			return 1
		}
		const pipeline = createPipeline({ store, config, tools, log: quiet })
		pipeline.start()
		store.setRow(TABLES.items, "one", newItem({ url: "u", videoId: "dQw4w9WgXcQ", order: "a0", addedAt: 1 }))
		await until(() => store.getCell(TABLES.items, "one", "transcript") === "en" && tools.files.has("one.m4a"))
		store.setCell(TABLES.items, "one", "wantKind", "video")
		await until(
			() =>
				store.getCell(TABLES.copies, copyId("one", DEVICE_SERVER), "kind") === "video" &&
				store.getCell(TABLES.copies, copyId("one", DEVICE_SERVER), "state") === COPY_STATE.ready
		)
		expect(tools.files.has("one.transcript.json")).toBe(true)
		store.delRow(TABLES.items, "one")
		await until(() => tools.files.size === 0)
		pipeline.stop()
	})
})
