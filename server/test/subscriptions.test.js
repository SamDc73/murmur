import { describe, expect, test } from "bun:test"
import { queueActions, TABLES } from "@murmur/core"
import { createMergeableStore } from "tinybase"
import { createSubscriptions } from "../src/subscriptions.js"

const quiet = {
	info() {
		// silent in tests
	},
	error() {
		// silent in tests
	},
}

// A channel as yt-dlp lists it: ids newest first.
function fakeTools(channels) {
	return {
		listChannel: async (url) => {
			const channel = channels[url]
			if (channel === undefined) throw new Error("No channel at that link")
			if (channel instanceof Error) throw channel
			return channel
		},
	}
}

function setup({ channels }) {
	const store = createMergeableStore("test")
	let next = 0
	const newId = () => `row${++next}`
	const actions = queueActions(store, { newId })
	const subs = createSubscriptions({ store, actions, tools: fakeTools(channels), newId, log: quiet })
	const queued = () => store.getTable(TABLES.items)
	const urls = () => Object.values(queued()).map((row) => row.videoId)
	return { store, actions, subs, queued, urls }
}

const URL = "https://www.youtube.com/@Fireship/videos"
const CHANNEL = {
	channelId: "UCsBjURrPoezykLs9EqgamOA",
	title: "Fireship",
	ids: ["vidAAAAAA03", "vidAAAAAA02", "vidAAAAAA01"],
}

describe("subscribing", () => {
	test("a link to a channel's videos is followed; its existing uploads are not queued", async () => {
		const { subs, queued, store } = setup({ channels: { [URL]: CHANNEL } })
		const followed = await subs.subscribe("https://www.youtube.com/@Fireship")
		expect(followed).toMatchObject({ title: "Fireship", url: URL })
		expect(subs.list()).toEqual([{ id: followed.id, title: "Fireship", url: URL }])
		expect(queued()).toEqual({})
		expect(store.getCell(TABLES.subscriptions, followed.id, "channelId")).toBe("UCsBjURrPoezykLs9EqgamOA")
	})

	test("following the same channel twice is one subscription", async () => {
		const BY_ID = "https://www.youtube.com/channel/UCsBjURrPoezykLs9EqgamOA/videos"
		const { subs } = setup({ channels: { [URL]: CHANNEL, [BY_ID]: CHANNEL } })
		const first = await subs.subscribe("https://www.youtube.com/@Fireship")
		const second = await subs.subscribe("https://www.youtube.com/channel/UCsBjURrPoezykLs9EqgamOA")
		expect(second.id).toBe(first.id)
		expect(subs.list()).toHaveLength(1)
	})

	test("something that isn't a channel is refused", async () => {
		const { subs } = setup({ channels: {} })
		await expect(subs.subscribe("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).rejects.toThrow("Not a YouTube channel")
	})

	test("unsubscribing stops the list, and a second time says nothing was there", async () => {
		const { subs } = setup({ channels: { [URL]: CHANNEL } })
		const { id } = await subs.subscribe("https://www.youtube.com/@Fireship")
		expect(subs.unsubscribe(id)).toBe(true)
		expect(subs.list()).toEqual([])
		expect(subs.unsubscribe(id)).toBe(false)
	})
})

describe("checking", () => {
	test("a new upload joins the end of the queue, and only once", async () => {
		const channels = { [URL]: { ...CHANNEL } }
		const { subs, urls } = setup({ channels })
		await subs.subscribe("https://www.youtube.com/@Fireship")

		channels[URL] = { ...CHANNEL, ids: ["vidAAAAAA04", "vidAAAAAA03", "vidAAAAAA02", "vidAAAAAA01"] }
		await subs.checkAll()
		expect(urls()).toEqual(["vidAAAAAA04"])

		await subs.checkAll()
		expect(urls()).toEqual(["vidAAAAAA04"])
	})

	test("several new uploads queue oldest first, so the newest plays last", async () => {
		const channels = { [URL]: { ...CHANNEL } }
		const { subs, urls } = setup({ channels })
		await subs.subscribe("https://www.youtube.com/@Fireship")
		channels[URL] = { ...CHANNEL, ids: ["vidAAAAAA05", "vidAAAAAA04", "vidAAAAAA03", "vidAAAAAA02", "vidAAAAAA01"] }
		await subs.checkAll()
		expect(urls()).toEqual(["vidAAAAAA04", "vidAAAAAA05"])
	})

	test("an episode taken off the queue doesn't come back", async () => {
		const channels = { [URL]: { ...CHANNEL } }
		const { subs, actions, queued, urls } = setup({ channels })
		await subs.subscribe("https://www.youtube.com/@Fireship")
		channels[URL] = { ...CHANNEL, ids: ["vidAAAAAA04", "vidAAAAAA03", "vidAAAAAA02", "vidAAAAAA01"] }
		await subs.checkAll()
		actions.remove(Object.keys(queued())[0])
		await subs.checkAll()
		expect(urls()).toEqual([])
	})

	test("a new upload that is already queued is not queued again", async () => {
		const channels = { [URL]: { ...CHANNEL } }
		const { subs, actions, urls } = setup({ channels })
		await subs.subscribe("https://www.youtube.com/@Fireship")
		actions.addText("https://www.youtube.com/watch?v=c4")
		channels[URL] = { ...CHANNEL, ids: ["vidAAAAAA04", "vidAAAAAA03", "vidAAAAAA02", "vidAAAAAA01"] }
		await subs.checkAll()
		expect(urls()).toEqual(["vidAAAAAA04"])
	})

	test("a channel that fails to list is skipped, and the others still check", async () => {
		const OTHER = "https://www.youtube.com/@Other/videos"
		const channels = {
			[URL]: { ...CHANNEL },
			[OTHER]: { channelId: "UC2", title: "Other", ids: ["othAAAAAA01"] },
		}
		const { subs, urls } = setup({ channels })
		await subs.subscribe("https://www.youtube.com/@Fireship")
		await subs.subscribe("https://www.youtube.com/@Other")
		channels[URL] = new Error("YouTube refused")
		channels[OTHER] = { channelId: "UC2", title: "Other", ids: ["othAAAAAA02", "othAAAAAA01"] }
		await subs.checkAll()
		expect(urls()).toEqual(["othAAAAAA02"])
	})

	test("checks don't overlap: a second call while one runs does nothing", async () => {
		const channels = { [URL]: { ...CHANNEL } }
		const { subs, urls } = setup({ channels })
		await subs.subscribe("https://www.youtube.com/@Fireship")
		channels[URL] = { ...CHANNEL, ids: ["vidAAAAAA04", "vidAAAAAA03", "vidAAAAAA02", "vidAAAAAA01"] }
		await Promise.all([subs.checkAll(), subs.checkAll()])
		expect(urls()).toEqual(["vidAAAAAA04"])
	})
})
