import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

// Everything the server takes from the environment, read once. Defaults suit
// `bun run dev` from this directory; docker-compose sets DATA_DIR and TOKEN.

const dataDir = resolve(process.env.DATA_DIR ?? "./data")
mkdirSync(join(dataDir, "media"), { recursive: true })

export const CONFIG = {
	port: Number(process.env.PORT ?? 3000),
	hostname: process.env.HOST ?? "0.0.0.0",
	dataDir,
	mediaDir: join(dataDir, "media"),
	dbPath: join(dataDir, "murmur.sqlite"),
	// One shared secret. Empty means "no auth" — only sane behind Tailscale or on a LAN.
	token: process.env.MURMUR_TOKEN ?? "",
	// Where clients reach this server (https://murmur.example.com behind Caddy).
	// Empty: the pairing code printed at startup uses this machine's name.
	publicUrl: (process.env.PUBLIC_URL ?? "").replace(/\/+$/, ""),
	ytdlp: process.env.YTDLP_BIN ?? "yt-dlp",
	// Extra flags for every yt-dlp call: cookies, proxies, `--js-runtimes node`…
	ytdlpArgs: (process.env.YTDLP_ARGS ?? "").split(/\s+/).filter(Boolean),
	// A datacenter IP often needs cookies to get past YouTube's bot check.
	cookies: process.env.YTDLP_COOKIES ?? join(dataDir, "cookies.txt"),
	downloadConcurrency: Number(process.env.DOWNLOAD_CONCURRENCY ?? 1),
	probeConcurrency: Number(process.env.PROBE_CONCURRENCY ?? 2),
	deviceName: process.env.SERVER_NAME ?? "Server",
}
