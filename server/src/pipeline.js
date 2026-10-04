import { readdirSync, statSync, unlinkSync } from "node:fs"
import { basename, join } from "node:path"
import {
	COPY_STATE,
	classifyLinks,
	copyId,
	DEVICE_SERVER,
	keysBetween,
	newCopy,
	newItem,
	parseGoogleDocUrl,
	queueOf,
	setting,
	TABLES,
	VALUES,
	wantedKind,
} from "@murmur/core"
import { uuidv7 } from "uuidv7"
import { readDoc } from "./docs.js"
import { metadataFrom } from "./ytdlp.js"

// What the server does with the store, and the only place it writes to it.
//
// The store is the work queue. A phone adds a row with just a URL; this sees
// it and fills the title, chapters and thumbnail; sees it resolved and
// downloads it; sees `keepOnServer` off and lets go of its file once a phone
// has one. Every step is a cell it can read back, so a restart
// mid-download simply picks up where the cells say it was. Nothing here is
// reachable over HTTP.
//
// `tools` is injected so tests can run the whole pipeline without yt-dlp.

const TICK_DEBOUNCE_MS = 150
const PROGRESS_EVERY_MS = 750
const DEVICE_TOUCH_MS = 60 * 60 * 1000

export function createPipeline({ store, config, tools, log = console }) {
	const inflight = new Set()
	let tickTimer = null
	// Transcripts share the probe slots: both are short yt-dlp calls.
	const running = { probe: 0, download: 0, transcript: 0 }
	const listeners = []
	let knownItemIds = new Set(store.getRowIds(TABLES.items))

	function schedule() {
		if (tickTimer !== null) return
		tickTimer = setTimeout(() => {
			tickTimer = null
			tick().catch((error) => log.error("[pipeline] tick failed", error))
		}, TICK_DEBOUNCE_MS)
	}

	// Every item, in play order, current first — so the next thing to play is
	// always the next thing fetched. Details and transcripts for all of them;
	// files only for the few coming up (`downloadAhead`). Anything further down,
	// or played, lets its file go, and fetches it again if it comes back up.
	function plan() {
		const items = store.getTable(TABLES.items)
		const values = store.getValues()
		const copies = store.getTable(TABLES.copies)
		const keep = setting(values, VALUES.keepOnServer)
		const currentId = setting(values, VALUES.currentItemId)
		const queue = queueOf(items)
		const ordered = [...queue.filter(([id]) => id === currentId), ...queue.filter(([id]) => id !== currentId)]
		// The window counts only episodes that can download.
		const playable = ordered.filter(([, row]) => !row.error)
		const ahead = new Set(playable.slice(0, config.downloadAhead ?? Number.POSITIVE_INFINITY).map(([id]) => id))
		const work = []

		for (const [id, row] of ordered) {
			if (inflight.has(id)) continue
			if (row.error) continue
			// Never probed, or probed before transcripts existed (no captionLang
			// cell at all): ask again once. Everything else builds on it.
			if (!row.resolvedAt || row.captionLang === undefined) {
				work.push({ kind: "probe", id })
				continue
			}
			if (row.captionLang && !row.transcript && !row.transcriptTried && !inflight.has(`transcript:${id}`)) {
				work.push({ kind: "transcript", id })
			}
			const wanted = wantedKind(row, values)
			const copy = copies[copyId(id, DEVICE_SERVER)]
			if (!ahead.has(id)) {
				if (holdsFile(copy)) work.push({ kind: "drop", id })
			} else if (!copy) {
				work.push({ kind: "download", id, mediaKind: wanted })
			} else if (row.wantKind && copy.kind !== row.wantKind && copy.state !== COPY_STATE.downloading) {
				// The other kind was asked for — even after the file went to a phone.
				work.push({ kind: "download", id, mediaKind: wanted })
			} else if (copy.state === COPY_STATE.evicted && keep) {
				work.push({ kind: "download", id, mediaKind: wanted })
			} else if (copy.state === COPY_STATE.ready && !keep && phoneHas(copies, id, copy.kind)) {
				work.push({ kind: "evict", id })
			} else if (copy.state === COPY_STATE.downloading || copy.state === COPY_STATE.pending) {
				// The server died mid-download: the file is not there, start over.
				work.push({ kind: "download", id, mediaKind: copy.kind || wanted })
			}
		}
		for (const [id, row] of Object.entries(items)) {
			if (!row.doneAt || inflight.has(id)) continue
			// Played before its details arrived (marked as played while fetching):
			// History still deserves a title. Details only — nothing is downloaded.
			if (!row.resolvedAt && !row.error) work.push({ kind: "probe", id })
			// Played: the file goes ("Play again" fetches it back).
			if (holdsFile(copies[copyId(id, DEVICE_SERVER)])) work.push({ kind: "drop", id })
		}
		return work
	}

	async function tick() {
		cleanupRemoved()
		for (const job of plan()) {
			const shortJobs = running.probe + running.transcript
			if (job.kind === "probe" && shortJobs < config.probeConcurrency) start(job, probeItem)
			else if (job.kind === "transcript" && shortJobs < config.probeConcurrency) start(job, transcriptItem)
			else if (job.kind === "download" && running.download < config.downloadConcurrency) start(job, downloadItem)
			else if (job.kind === "evict") evictItem(job.id)
			else if (job.kind === "drop") dropFile(job.id)
		}
	}

	// A transcript runs beside its item's download, so it has its own key.
	function start(job, fn) {
		const key = job.kind === "transcript" ? `transcript:${job.id}` : job.id
		inflight.add(key)
		running[job.kind]++
		fn(job)
			.catch((error) => log.error(`[pipeline] ${job.kind} ${job.id} failed`, error))
			.finally(() => {
				inflight.delete(key)
				running[job.kind]--
				schedule()
			})
	}

	async function probeItem({ id }) {
		const row = store.getRow(TABLES.items, id)
		if (!row?.url) return
		const doc = parseGoogleDocUrl(row.url)
		if (doc !== null) return importDoc(id, doc)
		const playlistOnly = row.videoId === "" && /[?&]list=/.test(row.url)
		log.info(`[pipeline] probe ${row.url}`)
		try {
			const info = await tools.probe(row.url, { playlist: playlistOnly })
			// Removed while yt-dlp was thinking: writing now would resurrect it.
			if (!store.hasRow(TABLES.items, id)) return
			const entries = info?.entries
			if (info?._type === "playlist" && Array.isArray(entries)) {
				expandPlaylist(id, info)
				return
			}
			const meta = metadataFrom(info)
			store.setPartialRow(TABLES.items, id, { ...meta, resolvedAt: Date.now(), error: "" })
		} catch (error) {
			if (!store.hasRow(TABLES.items, id)) return
			store.setPartialRow(TABLES.items, id, { error: String(error.message ?? error).slice(0, 300) })
		}
	}

	function expandPlaylist(id, info) {
		const entries = info.entries.filter((entry) => entry && typeof entry.id === "string" && entry.id.length === 11)
		if (entries.length === 0) {
			store.setPartialRow(TABLES.items, id, { error: "Playlist has no playable videos" })
			return
		}
		expandInPlace(
			id,
			entries.map((entry) => ({
				url: `https://www.youtube.com/watch?v=${entry.id}`,
				videoId: entry.id,
				...hint(entry),
			}))
		)
	}

	// A Google Doc's YouTube links take its place, minus any already queued or
	// played. (A playlist among them expands in turn, on its own probe.)
	async function importDoc(id, doc) {
		log.info(`[pipeline] import ${doc.url}`)
		try {
			const links = await tools.readDoc(doc.docUrl)
			if (!store.hasRow(TABLES.items, id)) return
			const { fresh } = classifyLinks(links, store.getTable(TABLES.items))
			if (fresh.length === 0) {
				const error = links.length === 0 ? "No YouTube links in that doc" : "Everything in that doc is already here"
				store.setPartialRow(TABLES.items, id, { error })
				return
			}
			expandInPlace(
				id,
				fresh.map((link) => ({ url: link.url, videoId: link.videoId, position: link.start }))
			)
		} catch (error) {
			if (store.hasRow(TABLES.items, id)) {
				store.setPartialRow(TABLES.items, id, { error: String(error.message ?? error).slice(0, 300) })
			}
		}
	}

	// A pasted list — a playlist, a doc — opens up where it was pasted: its
	// row becomes the first entry and the rest follow it, in order, each left
	// for its own full probe.
	function expandInPlace(id, rows) {
		const queue = queueOf(store.getTable(TABLES.items))
		const at = queue.findIndex(([rowId]) => rowId === id)
		const order = store.getCell(TABLES.items, id, "order")
		const keys = keysBetween(order, at === -1 ? null : (queue[at + 1]?.[1].order ?? null), rows.length - 1)
		const [first, ...rest] = rows
		const now = Date.now()
		store.transaction(() => {
			store.setPartialRow(TABLES.items, id, { ...first, resolvedAt: 0, error: "" })
			rest.forEach((row, index) => {
				store.setRow(TABLES.items, uuidv7(), {
					...newItem({ url: row.url, videoId: row.videoId, order: keys[index], addedAt: now + index }),
					...row,
				})
			})
		})
	}

	// What a flat playlist entry already knows, so a row is never blank.
	function hint(entry) {
		return {
			title: String(entry.title ?? ""),
			channel: String(entry.channel ?? entry.uploader ?? ""),
			duration: Math.round(Number(entry.duration) || 0),
			thumbnail: `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
		}
	}

	async function downloadItem({ id, mediaKind }) {
		const row = store.getRow(TABLES.items, id)
		if (!row) return
		const cid = copyId(id, DEVICE_SERVER)
		const values = store.getValues()
		// The item can be removed while yt-dlp runs. From then on every write
		// is skipped and whatever it leaves on disk is deleted.
		const removed = () => !store.hasRow(TABLES.items, id)
		const dropped = () => {
			removeFiles(id)
			log.info(`[pipeline] dropped ${id}: removed while downloading`)
		}
		removeFiles(id, { keepTranscript: true })
		store.setRow(TABLES.copies, cid, {
			...newCopy({ itemId: id, deviceId: DEVICE_SERVER, kind: mediaKind, updatedAt: Date.now() }),
			state: COPY_STATE.downloading,
		})
		log.info(`[pipeline] download ${mediaKind} ${row.title || row.url}`)
		let lastProgressAt = 0
		try {
			const path = await tools.download(
				{
					url: row.url,
					itemId: id,
					kind: mediaKind,
					audioFormat: setting(values, VALUES.audioFormat),
					videoHeight: setting(values, VALUES.videoHeight),
				},
				({ downloaded, total }) => {
					const now = Date.now()
					if (now - lastProgressAt < PROGRESS_EVERY_MS || removed()) return
					lastProgressAt = now
					store.setPartialRow(TABLES.copies, cid, {
						progress: total > 0 ? Math.min(1, downloaded / total) : 0,
						bytes: downloaded,
						updatedAt: now,
					})
				}
			)
			if (removed()) return dropped()
			const size = statSync(path).size
			store.setPartialRow(TABLES.copies, cid, {
				state: COPY_STATE.ready,
				progress: 1,
				bytes: size,
				uri: basename(path),
				error: "",
				updatedAt: Date.now(),
			})
			log.info(`[pipeline] ready ${basename(path)} (${size} bytes)`)
		} catch (error) {
			if (removed()) return dropped()
			const message = String(error.message ?? error).slice(0, 300)
			log.warn(`[pipeline] download failed ${row.title || row.url}: ${message}`)
			store.setPartialRow(TABLES.copies, cid, { state: COPY_STATE.error, error: message, updatedAt: Date.now() })
		}
	}

	async function transcriptItem({ id }) {
		const row = store.getRow(TABLES.items, id)
		if (!row?.url) return
		log.info(`[pipeline] transcript ${row.captionLang}${row.captionAuto ? " (auto)" : ""} ${row.title || row.url}`)
		try {
			const count = await tools.transcript({ url: row.url, itemId: id, lang: row.captionLang, auto: row.captionAuto })
			if (!store.hasRow(TABLES.items, id)) {
				removeFiles(id)
				return
			}
			store.setCell(TABLES.items, id, "transcript", row.captionLang)
			log.info(`[pipeline] transcript ready: ${count} lines`)
		} catch (error) {
			if (store.hasRow(TABLES.items, id)) store.setCell(TABLES.items, id, "transcriptTried", Date.now())
			log.warn(`[pipeline] no transcript for ${row.title || row.url}: ${String(error.message ?? error).slice(0, 200)}`)
		}
	}

	function evictItem(id) {
		removeFiles(id, { keepTranscript: true })
		store.setPartialRow(TABLES.copies, copyId(id, DEVICE_SERVER), {
			state: COPY_STATE.evicted,
			progress: 0,
			bytes: 0,
			uri: "",
			updatedAt: Date.now(),
		})
		log.info(`[pipeline] evicted ${id}: a phone has it and the server keeps nothing`)
	}

	// Not coming up soon, or played: the file and the server's copy row go
	// (the transcript stays). An evicted copy is left alone — a phone has it.
	function dropFile(id) {
		removeFiles(id, { keepTranscript: true })
		store.delRow(TABLES.copies, copyId(id, DEVICE_SERVER))
		log.info(`[pipeline] let go of ${store.getCell(TABLES.items, id, "title") || id}: not coming up soon`)
	}

	// Replacing or evicting the media keeps the transcript; removing the item does not.
	function removeFiles(id, { keepTranscript = false } = {}) {
		for (const name of tools.listFiles()) {
			if (!name.startsWith(`${id}.`)) continue
			if (keepTranscript && name.endsWith(".transcript.json")) continue
			tools.removeFile(name)
		}
	}

	// A row that vanished was removed by the user: its file goes, and so do
	// every device's copy rows (phones delete their file when theirs vanishes).
	// Listeners only note the ids; the store is written from the tick, because
	// TinyBase drops writes made inside a non-mutator listener.
	const removed = new Set()
	function onItemIds() {
		const now = new Set(store.getRowIds(TABLES.items))
		for (const id of knownItemIds) if (!now.has(id)) removed.add(id)
		knownItemIds = now
	}

	function cleanupRemoved() {
		if (removed.size === 0) return
		store.transaction(() => {
			for (const id of removed) {
				removeFiles(id)
				for (const cid of store.getRowIds(TABLES.copies)) {
					if (store.getCell(TABLES.copies, cid, "itemId") === id) store.delRow(TABLES.copies, cid)
				}
			}
		})
		removed.clear()
	}

	function touchDevice() {
		store.setRow(TABLES.devices, DEVICE_SERVER, {
			name: config.deviceName,
			kind: "server",
			lastSeen: Date.now(),
		})
	}

	let deviceTimer = null
	return {
		start() {
			listeners.push(store.addTableListener(TABLES.items, schedule))
			listeners.push(store.addTableListener(TABLES.copies, schedule))
			listeners.push(store.addValuesListener(schedule))
			listeners.push(store.addRowIdsListener(TABLES.items, onItemIds))
			touchDevice()
			deviceTimer = setInterval(touchDevice, DEVICE_TOUCH_MS)
			schedule()
		},
		stop() {
			for (const id of listeners) store.delListener(id)
			listeners.length = 0
			if (tickTimer !== null) clearTimeout(tickTimer)
			if (deviceTimer !== null) clearInterval(deviceTimer)
		},
		// For tests and /api/info.
		plan,
		get running() {
			return { ...running, inflight: [...inflight] }
		},
	}
}

// The server's copy row stands for a file here, or one on its way (a failed
// download counts: letting it go means trying afresh when it comes back up).
function holdsFile(copy) {
	return copy !== undefined && copy.state !== COPY_STATE.evicted
}

// A phone holds this item, in the kind the server has (not a stale audio
// copy of what is now a video).
function phoneHas(copies, itemId, kind) {
	return Object.values(copies).some(
		(copy) =>
			copy.itemId === itemId && copy.deviceId !== DEVICE_SERVER && copy.state === COPY_STATE.ready && copy.kind === kind
	)
}

/** The real tools: yt-dlp and the media directory. */
export function realTools(config, ytdlp) {
	return {
		probe: (url, options) => ytdlp.probe(config, url, options),
		download: (item, onProgress) => ytdlp.download(config, item, onProgress),
		transcript: (item) => ytdlp.fetchTranscript(config, item),
		readDoc: (url) => readDoc(url),
		listFiles: () => readdirSync(config.mediaDir),
		removeFile: (name) => {
			try {
				unlinkSync(join(config.mediaDir, name))
			} catch {
				// already gone
			}
		},
	}
}
