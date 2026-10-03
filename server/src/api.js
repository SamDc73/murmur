import { COPY_STATE, copyId, DEVICE_SERVER, historyOf, queueOf, setting, TABLES, VALUES } from "@murmur/core"
import { Hono } from "hono"

// The HTTP API: the queue as the apps see it, behind the same token.
//
//   GET    /api/queue        the queue, in play order
//   GET    /api/history      what's been played, newest first
//   POST   /api/queue        any text with YouTube or Google Docs links in it
//   PATCH  /api/queue/:id    {"index": 0} moves it · {"played": true} to History, false back
//   DELETE /api/queue/:id    gone everywhere, files too
//
// Every change goes through the same functions as the apps' buttons, and
// reaches every device at once.
export function api(store, actions) {
	const app = new Hono()
	const items = () => store.getTable(TABLES.items)
	const find = (c) => {
		const id = c.req.param("id")
		return store.hasRow(TABLES.items, id) ? id : null
	}

	// One episode, plainly.
	const episode = (id, row) => ({
		id,
		url: row.url,
		title: row.title,
		channel: row.channel,
		duration: row.duration,
		position: row.position,
		playing: id === setting(store.getValues(), VALUES.currentItemId),
		ready: store.getCell(TABLES.copies, copyId(id, DEVICE_SERVER), "state") === COPY_STATE.ready,
		error: row.error || null,
		playedAt: row.doneAt ? new Date(row.doneAt).toISOString() : null,
	})

	app.get("/queue", (c) => c.json(queueOf(items()).map(([id, row]) => episode(id, row))))
	app.get("/history", (c) => c.json(historyOf(items()).map(([id, row]) => episode(id, row))))

	app.post("/queue", async (c) => {
		const { added, requeued } = actions.addText(await c.req.text())
		if (added.length + requeued.length === 0) return c.json({ error: "No YouTube or Google Docs link in that" }, 400)
		return c.json({ added, requeued }, 201)
	})

	app.patch("/queue/:id", async (c) => {
		const id = find(c)
		if (id === null) return c.json({ error: "No such episode" }, 404)
		const body = await c.req.json().catch(() => ({}))
		if (body.played === true) actions.markDone(id)
		if (body.played === false) actions.requeue(id)
		if (Number.isInteger(body.index)) {
			const queue = queueOf(items())
			const from = queue.findIndex(([rowId]) => rowId === id)
			if (from !== -1) actions.move(from, Math.max(0, Math.min(body.index, queue.length - 1)))
		}
		return c.json(episode(id, store.getRow(TABLES.items, id)))
	})

	app.delete("/queue/:id", (c) => {
		const id = find(c)
		if (id === null) return c.json({ error: "No such episode" }, 404)
		actions.remove(id)
		return c.body(null, 204)
	})

	return app
}
