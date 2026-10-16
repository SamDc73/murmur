import { channelVideosUrl, newSubscription, remember, seenOf, TABLES, unseenIds } from "@murmur/core"

// Followed YouTube channels. Every CHECK_EVERY_MS the server lists each
// channel's newest uploads and queues the ones it hasn't seen, at the end of
// the queue. Seen is kept per channel, so nothing is queued twice, and an
// episode taken off the queue doesn't come back. A channel that fails to list
// is skipped and tried again next time, with nothing lost.

const CHECK_EVERY_MS = 30 * 60 * 1000

/**
 * @param store      the server's store
 * @param actions    queueActions(store, …)
 * @param tools      { listChannel(url) } — the yt-dlp listing, injected for tests
 * @param newId      makes row ids
 */
export function createSubscriptions({ store, actions, tools, newId, every = CHECK_EVERY_MS, log = console }) {
	const rows = () => store.getTable(TABLES.subscriptions)
	let checking = false

	/** Follow a channel. Its uploads so far count as seen: only later ones queue. */
	async function subscribe(input) {
		const url = channelVideosUrl(input)
		if (url === null) throw new Error("Not a YouTube channel link")
		const channel = await tools.listChannel(url)
		const existing = Object.entries(rows()).find(([, row]) => row.channelId === channel.channelId)
		if (existing) return { id: existing[0], title: existing[1].title, url: existing[1].url }
		const id = newId()
		store.setRow(
			TABLES.subscriptions,
			id,
			newSubscription({
				url,
				channelId: channel.channelId,
				title: channel.title,
				seen: channel.ids,
				addedAt: Date.now(),
			})
		)
		return { id, title: channel.title, url }
	}

	function unsubscribe(id) {
		if (!store.hasRow(TABLES.subscriptions, id)) return false
		store.delRow(TABLES.subscriptions, id)
		return true
	}

	function list() {
		return Object.entries(rows()).map(([id, row]) => ({ id, title: row.title, url: row.url }))
	}

	async function checkOne(id, row) {
		const channel = await tools.listChannel(row.url)
		const seen = seenOf(row)
		const fresh = unseenIds(channel.ids, seen)
		if (fresh.length > 0) {
			const text = fresh.map((videoId) => `https://www.youtube.com/watch?v=${videoId}`).join("\n")
			const { added } = actions.addPlanned(actions.planAdd(text))
			log.info(`[subs] ${row.title}: ${added.length} new`)
		}
		// Unsubscribed while listing: nothing to remember.
		if (store.hasRow(TABLES.subscriptions, id)) {
			store.setCell(TABLES.subscriptions, id, "seen", JSON.stringify(remember(seen, channel.ids)))
		}
	}

	/** Check every channel once. A second call while one is running does nothing. */
	async function checkAll() {
		if (checking) return
		checking = true
		try {
			for (const [id, row] of Object.entries(rows())) {
				try {
					await checkOne(id, row)
				} catch (error) {
					log.error(`[subs] ${row.title}: ${error.message}`)
				}
			}
		} finally {
			checking = false
		}
	}

	/** Check on a timer. Returns a function that stops it. */
	function start() {
		const timer = setInterval(() => checkAll(), every)
		return () => clearInterval(timer)
	}

	return { subscribe, unsubscribe, list, checkAll, start }
}
