import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { extname, join } from "node:path"
import { keysAfter, lastKey, newItem, parseYouTubeUrl, queueOf, TABLES } from "@murmur/core"
import { createMergeableStore } from "tinybase"
import { createWsSynchronizer } from "tinybase/synchronizers/synchronizer-ws-client"

// Everything the end-to-end tests stand on: a real server in a throwaway
// directory, peers that talk to it the way a phone does, and a stand-in for
// Caddy that serves the web build next to the API. Nothing here is mocked;
// yt-dlp talks to the real YouTube.

const ROOT = new URL("..", import.meta.url).pathname

// Short, old, stable uploads — the whole suite downloads a few megabytes.
export const ZOO = { id: "jNQXAC9IVRw", url: "https://youtu.be/jNQXAC9IVRw", title: "Me at the zoo", seconds: 19 }
export const SNOWBOARD = {
	id: "LeAltgu_pbM",
	url: "https://youtu.be/LeAltgu_pbM",
	title: "My Snowboarding Skillz",
	seconds: 11,
}
export const TEST_8K = { id: "a9LDPn-MO4I", url: "https://youtu.be/a9LDPn-MO4I", seconds: 60 }
// The "jawed" channel's uploads: a playlist of exactly one video, the zoo.
export const ZOO_PLAYLIST = "https://www.youtube.com/playlist?list=UU4QobU6STFB0P71PMvOGN5A"
export const DEAD = "https://youtu.be/aaaaaaaaaaa"

/** Poll until `check` returns something truthy; return it. */
export async function waitFor(check, { timeout = 60_000, every = 250, label = "condition" } = {}) {
	const started = Date.now()
	let last
	while (Date.now() - started < timeout) {
		try {
			last = await check()
			if (last) return last
		} catch (error) {
			last = error
		}
		await Bun.sleep(every)
	}
	throw new Error(
		`timed out after ${timeout} ms waiting for ${label}${last instanceof Error ? `: ${last.message}` : ""}`
	)
}

/** A real server: `bun src/index.js` with its own port, data and token. */
export async function startServer({ port = 3790, token = "e2e-token", dataDir } = {}) {
	const dir = dataDir ?? mkdtempSync(join(tmpdir(), "murmur-e2e-"))
	const url = `http://127.0.0.1:${port}`
	let proc = null
	let log = ""

	async function start() {
		// Something already answering here (a run that bailed out) would be
		// tested in our place, with its own data. Refuse instead.
		const taken = await fetch(`${url}/api/health`).then(
			() => true,
			() => false
		)
		if (taken) throw new Error(`port ${port} is already in use — stop whatever is serving ${url}`)
		log = ""
		proc = Bun.spawn(["bun", "src/index.js"], {
			cwd: join(ROOT, "server"),
			// Explicit values win over server/.env, which Bun would otherwise load.
			env: {
				...process.env,
				PORT: String(port),
				HOST: "127.0.0.1",
				DATA_DIR: dir,
				MURMUR_PASSWORD: token,
				// The suite queues more than a listener's window and expects each to
				// download; the window itself has its own test (server/test).
				DOWNLOAD_AHEAD: "50",
				PUBLIC_URL: url,
			},
			stdout: "pipe",
			stderr: "pipe",
		})
		for (const stream of [proc.stdout, proc.stderr]) {
			;(async () => {
				for await (const chunk of stream) log += new TextDecoder().decode(chunk)
			})()
		}
		await waitFor(() => fetch(`${url}/api/health`).then((r) => r.ok), { timeout: 20_000, label: "server to start" })
	}

	async function stop() {
		proc?.kill()
		await proc?.exited
		proc = null
	}

	await start()
	return {
		url,
		port,
		token,
		dataDir: dir,
		get log() {
			return log
		},
		start,
		stop,
		/** Files in DATA_DIR/media, name → bytes. */
		files() {
			const media = join(dir, "media")
			if (!existsSync(media)) return {}
			return Object.fromEntries(readdirSync(media).map((name) => [name, statSync(join(media, name)).size]))
		},
		path: (name) => join(dir, "media", name),
		api: (path, init = {}) =>
			fetch(`${url}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } }),
		async cleanup() {
			await stop()
			if (!dataDir) rmSync(dir, { recursive: true, force: true })
		},
	}
}

/** A device on the store, the way a phone joins: a MergeableStore over the WebSocket. */
export async function connectPeer(server) {
	const store = createMergeableStore()
	const socket = new WebSocket(`${server.url.replace(/^http/, "ws")}/sync?token=${encodeURIComponent(server.token)}`)
	const synchronizer = await createWsSynchronizer(store, socket)
	await synchronizer.startSync()
	await waitFor(() => store.hasRow(TABLES.devices, "server"), { timeout: 10_000, label: "first sync" })
	return {
		store,
		close() {
			synchronizer.destroy()
			socket.close()
		},
		item: (id) => store.getRow(TABLES.items, id),
		copy: (id, device = "server") => store.getRow(TABLES.copies, `${id}:${device}`),
		/** Append links to the queue exactly as the app's addLinks does. Returns their ids. */
		add(...urls) {
			const ids = urls.map(() => crypto.randomUUID())
			const keys = keysAfter(lastKey(queueOf(store.getTable(TABLES.items))), urls.length)
			store.transaction(() => {
				urls.forEach((url, index) => {
					const link = parseYouTubeUrl(url)
					store.setRow(TABLES.items, ids[index], {
						...newItem({ url: link.url, videoId: link.videoId, order: keys[index], addedAt: Date.now() + index }),
						position: link.start,
					})
				})
			})
			return ids
		},
	}
}

/** ffprobe's view of a downloaded file: duration, codecs, video height. */
export async function probeFile(path) {
	const proc = Bun.spawn(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path])
	const info = JSON.parse(await new Response(proc.stdout).text())
	const video = info.streams.find((stream) => stream.codec_type === "video")
	const audio = info.streams.find((stream) => stream.codec_type === "audio")
	return {
		seconds: Number(info.format.duration),
		audio: audio?.codec_name ?? "",
		video: video?.codec_name ?? "",
		height: video?.height ?? 0,
	}
}

/** Export the web app once (the production build Caddy serves). */
export async function buildWeb() {
	const out = mkdtempSync(join(tmpdir(), "murmur-web-"))
	const proc = Bun.spawn(["bunx", "expo", "export", "--platform", "web", "--output-dir", out], {
		cwd: join(ROOT, "app"),
		env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1", DO_NOT_TRACK: "1" },
		stdout: "pipe",
		stderr: "pipe",
	})
	if ((await proc.exited) !== 0) throw new Error(`expo export failed:\n${await new Response(proc.stderr).text()}`)
	return out
}

const TYPES = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".png": "image/png",
	".ttf": "font/ttf",
	".ico": "image/x-icon",
}

/** Caddy's job in miniature: the web build at /, `/api` and `/sync` to the server. */
export function serveWeb(distDir, server, port = 3792) {
	const upstream = server.url
	const http = Bun.serve({
		port,
		hostname: "127.0.0.1",
		async fetch(request, bun) {
			const url = new URL(request.url)
			if (url.pathname === "/sync") {
				const target = `${upstream.replace(/^http/, "ws")}/sync${url.search}`
				return bun.upgrade(request, { data: { target, queue: [] } })
					? undefined
					: new Response("no upgrade", { status: 400 })
			}
			if (url.pathname.startsWith("/api/")) {
				// Like Caddy: an upstream that is down is a 502, not a crash.
				return fetch(`${upstream}${url.pathname}${url.search}`, {
					method: request.method,
					headers: request.headers,
				}).catch(() => new Response("bad gateway", { status: 502 }))
			}
			const path = join(distDir, url.pathname)
			const file = existsSync(path) && statSync(path).isFile() ? Bun.file(path) : Bun.file(join(distDir, "index.html"))
			return new Response(file, {
				headers: { "Content-Type": TYPES[extname(file.name)] ?? "application/octet-stream" },
			})
		},
		websocket: {
			open(client) {
				const up = new WebSocket(client.data.target)
				up.binaryType = "arraybuffer"
				client.data.up = up
				up.onopen = () => {
					for (const message of client.data.queue) up.send(message)
				}
				up.onmessage = (event) => client.send(event.data)
				up.onclose = () => client.close()
			},
			message(client, message) {
				if (client.data.up.readyState === WebSocket.OPEN) client.data.up.send(message)
				else client.data.queue.push(message)
			},
			close(client) {
				client.data.up?.close()
			},
		},
	})
	return { url: `http://127.0.0.1:${port}`, stop: () => http.stop(true) }
}
