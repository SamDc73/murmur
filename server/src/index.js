import { networkInterfaces } from "node:os"
import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { pairLink, queueActions } from "@murmur/core"
import { Hono } from "hono"
import { cors } from "hono/cors"
import QRCode from "qrcode"
import { createWsSynchronizer } from "tinybase/synchronizers/synchronizer-ws-client"
import { createWsServer } from "tinybase/synchronizers/synchronizer-ws-server"
import { uuidv7 } from "uuidv7"
import { WebSocketServer } from "ws"
import { api } from "./api.js"
import { isAuthorised, tokenFrom } from "./auth.js"
import { CONFIG } from "./config.js"
import { createPipeline, realTools } from "./pipeline.js"
import { openStore } from "./store.js"
import * as ytdlp from "./ytdlp.js"

// On one port:
//   /sync        a TinyBase WebSocket hub. It holds nothing; it relays.
//   /api/media   the downloaded files, with Range.
//   /api/queue   the HTTP API (api.js).
// Plus one WebSocket client of its own — this process — which persists the
// store to SQLite and runs the yt-dlp pipeline. Making the server a client of
// its own hub means the hub never has to own state, and every phone and
// browser is a peer of the same store.

const app = new Hono()

// The web app may be served from another origin (a dev server, a different
// host), and its player fetches media with XHR — so Range and the token must
// be allowed through, and Content-Range must be readable.
app.use(
	"/api/*",
	cors({
		origin: "*",
		allowHeaders: ["Authorization", "Range", "Content-Type"],
		exposeHeaders: ["Content-Range", "Accept-Ranges", "Content-Length"],
		maxAge: 86400,
	})
)

app.use("/api/*", async (c, next) => {
	if (c.req.path === "/api/health") return next()
	if (!isAuthorised(CONFIG.token, tokenFrom(c.req.url, c.req.raw.headers))) {
		return c.json({ error: "unauthorised" }, 401)
	}
	return next()
})

// Public: whether this is a Murmur server, and whether it wants a token.
app.get("/api/health", (c) => c.json({ ok: true, locked: CONFIG.token !== "" }))

const { store } = await openStore(CONFIG)
app.route("/api", api(store, queueActions(store, { newId: uuidv7 })))
// The downloaded files — audio, video, transcripts — straight from DATA_DIR/media:
// /api/media/<itemId>.m4a, /api/media/<itemId>.transcript.json. serveStatic
// answers Range requests, which is how players seek. Hono's type table has
// no .m4a, so that one header is set here.
app.use("/api/media/*", async (c, next) => {
	await next()
	if (c.req.path.endsWith(".m4a")) c.res.headers.set("Content-Type", "audio/mp4")
})
app.get(
	"/api/media/*",
	serveStatic({ root: CONFIG.mediaDir, rewriteRequestPath: (path) => path.replace(/^\/api\/media/, "") })
)
let pipeline = null

let ytdlpVersion = ""
Bun.spawn([CONFIG.ytdlp, "--version"], { stdout: "pipe" })
	.stdout.text()
	.then((text) => {
		ytdlpVersion = text.trim()
	})
	.catch(() => {
		// yt-dlp missing: /api/info reports an empty version
	})

app.get("/api/info", (c) =>
	c.json({
		name: CONFIG.deviceName,
		ytdlp: ytdlpVersion,
		items: store.getRowCount("items"),
		running: pipeline?.running ?? null,
	})
)

const server = serve({ fetch: app.fetch, port: CONFIG.port, hostname: CONFIG.hostname }, (info) => {
	console.log(`[murmur] listening on http://${info.address}:${info.port}`)
})

const wss = new WebSocketServer({ noServer: true })
server.on("upgrade", (request, socket, head) => {
	const url = new URL(request.url, "http://local")
	if (url.pathname !== "/sync") {
		socket.destroy()
		return
	}
	if (!isAuthorised(CONFIG.token, tokenFrom(request.url, request.headers))) {
		socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n")
		socket.destroy()
		return
	}
	wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request))
})
const hub = createWsServer(wss)
hub.addClientIdsListener(null, (_server, pathId, clientId, addedOrRemoved) => {
	console.log(
		`[sync] ${addedOrRemoved > 0 ? "joined" : "left"} ${clientId} (${hub.getClientIds(pathId).length} on ${pathId})`
	)
})

// This process as a peer. It reconnects like any client would.
async function connectSelf() {
	const url = `ws://127.0.0.1:${CONFIG.port}/sync${CONFIG.token ? `?token=${encodeURIComponent(CONFIG.token)}` : ""}`
	const socket = new WebSocket(url)
	const synchronizer = await createWsSynchronizer(store, socket)
	await synchronizer.startSync()
	socket.addEventListener("close", () => {
		synchronizer.destroy()
		setTimeout(() => connectSelf().catch(console.error), 1000)
	})
}
await connectSelf()

pipeline = createPipeline({ store, config: CONFIG, tools: realTools(CONFIG, ytdlp) })
pipeline.start()

if (CONFIG.token === "") console.warn("[murmur] MURMUR_TOKEN is empty: anyone who can reach this port can use it")

// How a phone joins: scan this from the log (`docker compose logs server`),
// or from the web app's Settings once a browser is connected.
const link = pairLink(CONFIG.publicUrl || `http://${lanAddress()}:${CONFIG.port}`, CONFIG.token)
console.log(`[murmur] pair a phone by scanning this, or open the link on it:\n${link}\n`)
console.log(await QRCode.toString(link, { type: "terminal", small: true }))

// This machine's address on the home network — what a phone on the same Wi‑Fi
// can reach. Container hostnames and loopback are useless to a phone.
function lanAddress() {
	const addresses = Object.values(networkInterfaces())
		.flat()
		.filter((entry) => entry?.family === "IPv4" && !entry.internal)
		.map((entry) => entry.address)
	return (
		addresses.find((address) => /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(address)) ?? addresses[0] ?? "localhost"
	)
}
