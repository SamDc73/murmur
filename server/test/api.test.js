import { describe, expect, test } from "bun:test"
import { queueActions, TABLES, VALUES } from "@murmur/core"
import { createMergeableStore } from "tinybase"
import { api } from "../src/api.js"

let n = 0
function setup() {
	const store = createMergeableStore("t")
	const app = api(store, queueActions(store, { newId: () => `id${++n}` }))
	const call = async (method, path, body) => {
		const response = await app.request(path, { method, body: typeof body === "string" ? body : JSON.stringify(body) })
		return { status: response.status, json: response.status === 204 ? null : await response.json() }
	}
	return { store, call }
}

describe("the API", () => {
	test("POST takes any text with links in it; GET lists the queue in order", async () => {
		const { call } = setup()
		const added = await call("POST", "/queue", "https://youtu.be/jNQXAC9IVRw and youtu.be/LeAltgu_pbM")
		expect(added.status).toBe(201)
		expect(added.json.added.length).toBe(2)
		expect((await call("POST", "/queue", { links: "https://youtu.be/9bZkp7q19f0" })).json.added.length).toBe(1)
		const queue = (await call("GET", "/queue")).json
		expect(queue.map((e) => e.url)).toEqual([
			"https://www.youtube.com/watch?v=jNQXAC9IVRw",
			"https://www.youtube.com/watch?v=LeAltgu_pbM",
			"https://www.youtube.com/watch?v=9bZkp7q19f0",
		])
		expect(queue[0]).toMatchObject({ playing: false, ready: false, error: null, playedAt: null })
	})

	test("a Google Docs link is accepted; text with no link is not", async () => {
		const { call } = setup()
		expect(
			(await call("POST", "/queue", "docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit")).status
		).toBe(201)
		const nothing = await call("POST", "/queue", "hello")
		expect(nothing.status).toBe(400)
		expect(nothing.json.error).toBe("No YouTube or Google Docs link in that")
	})

	test("PATCH moves by index and sends to History and back; DELETE removes", async () => {
		const { store, call } = setup()
		const [a, b, c] = (await call("POST", "/queue", "youtu.be/jNQXAC9IVRw youtu.be/LeAltgu_pbM youtu.be/9bZkp7q19f0"))
			.json.added
		await call("PATCH", `/queue/${c}`, { index: 0 })
		expect((await call("GET", "/queue")).json.map((e) => e.id)).toEqual([c, a, b])
		await call("PATCH", `/queue/${a}`, { index: 99 })
		expect((await call("GET", "/queue")).json.map((e) => e.id)).toEqual([c, b, a])

		store.setValue(VALUES.currentItemId, c)
		const played = await call("PATCH", `/queue/${c}`, { played: true })
		expect(played.json.playedAt).not.toBeNull()
		expect((await call("GET", "/history")).json.map((e) => e.id)).toEqual([c])
		expect(store.getValue(VALUES.currentItemId)).toBe(b)
		await call("PATCH", `/queue/${c}`, { played: false })
		expect((await call("GET", "/queue")).json.map((e) => e.id)).toEqual([b, a, c])

		expect((await call("DELETE", `/queue/${b}`)).status).toBe(204)
		expect(store.hasRow(TABLES.items, b)).toBe(false)
		expect((await call("DELETE", `/queue/${b}`)).status).toBe(404)
		expect((await call("PATCH", "/queue/nope", { index: 0 })).status).toBe(404)
	})
})
