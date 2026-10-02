# Murmur

A queue of YouTube episodes that plays like a podcast app. Paste links — one, or a whole list — press play, and it runs top to bottom until the queue is empty. Your own server fetches the audio with yt-dlp; your phone downloads it and keeps playing with the screen off, from the lock screen, the notification, your earbuds.

Android and web from one Expo codebase. Self-hosted. One shared store, synced live between every device.

## How it fits together

```
phone / browser ──WebSocket──▶ server /sync (TinyBase hub, holds nothing)
       ▲                            │
       │  same store, CRDT-merged   ▼
       └──────────────── server's own client: SQLite + the yt-dlp pipeline
                                    │
phone ◀── /api/media/:id (Range) ───┘  files in DATA_DIR/media
```

- **The store is the queue.** Every device — and the server — holds the same TinyBase `MergeableStore`: `items` (episodes, with a fractional-index `order`), `copies` (which device holds which file), `devices`, and the settings as values. The phone works with no server at all; adding a server URL turns sync on.
- **The server is a peer with a job.** It watches the store: a row with only a URL gets probed (`yt-dlp -J`) and filled with title, channel, duration, thumbnail, chapters, description; a resolved row gets downloaded, and its captions fetched as a timed transcript; a playlist row expands into one row per entry. Progress is a cell, so every device sees it live.
- **The player holds one episode.** `react-native-track-player` (ExoPlayer on Android, shaka on web) only ever has the store's `currentItemId` loaded. When it ends, the episode moves to History and the one below it starts; after the last one, nothing — no wrap. Positions flow back into the rows every few seconds, so another device picks up where this one stopped.
- **The queue reads like a playlist.** Tap a row to play from there. *Play next* puts an episode right below the one playing. Drag a row by its handle to move it — a finger on a phone, a mouse on a desktop. A link that is already queued, or was played before, asks before it is added again.
- **Phones pull their own copy** from the server once it is ready (Wi‑Fi only by default), in the foreground and from a WorkManager task when the app is closed.

Two switches decide where files live. Each phone has *Download automatically* (on by default). The server has *Keep a copy on the server* (on by default; the switch only appears once a phone has synced). Turn the server's off and it hands each file to a phone, then lets its own copy go.

## Layout

| Path | What |
|---|---|
| `packages/core/` | schema, link parsing, queue ordering, formatting — shared by app and server, tested with `bun test` |
| `app/` | Expo 57 app (Android + web): NativeWind 5 on the Cyanotype & Verdigris tokens, expo-router, TinyBase hooks, track player bridge, downloads. Menus and dialogs are `@rn-primitives` (Radix on web), toasts are `sonner` / `sonner-native`, drag is `react-native-sortables`, server data is TanStack Query |
| `server/` | Bun + Hono: sync hub, yt-dlp pipeline, media with Range, one token |
| `docs/` | `kelvin-drift.html` — an alternative palette proposal, kept for reference |
| `e2e/` | end-to-end tests against a real server and real YouTube |
| `later.md` | what was left for next time, and why |

The logo, "Last Bounce" (an m drawn as a bouncing ball's path, the ball come to rest in verdigris), is one geometry in `packages/core/src/brand.js`. `cd app && bun run brand` redraws every file from it in the token colours: the app icon, Android's adaptive and monochrome layers, the light and dark splash, the favicon and the status-bar icon. It also writes the same colours into `app.json`, so icon and app can't drift apart.

Every colour, size and radius is a token in `app/theme/tokens.css`: Material 3 role names over two families, cyanotype (primary) and verdigris (tertiary), with the same steps. They are fixed brand colours, not the wallpaper's, so the app and its icon always match; Android's themed icons still tint the launcher icon if you turn them on.

## Run

```sh
bun install
cp server/.env.example server/.env   # set MURMUR_TOKEN (any long random string)
bun run dev                          # the server on :3000 and the web app on :8081, together
```

Open http://localhost:8081. The web app finds the server next door on :3000 by itself; go to Settings, enter the token, Save. The status line reads *Connected*, and every link you paste is fetched by the server and plays in order. The server needs `yt-dlp` and `ffmpeg` on PATH.

**A row says "waiting for server"?** The web app can't reach the server, or the token is wrong. Settings → Server says which. Starting only the web app (`cd app && bun run web`) gives exactly this: the queue fills, nothing is fetched.

### Checks

```sh
bun run lint            # Biome (format, React, a11y, import cycles), then ESLint (React's compiler rules,
                        # needless effects), then knip (unused files, exports, dependencies)
bun run test            # unit tests: core + server (fast, no network)
bun run e2e             # end to end, real YouTube, ~2 min
```

`bun run e2e` boots a real server in a temporary directory and drives it two ways:

- **`e2e/server.e2e.js`** talks to it as a phone does, over the sync socket and HTTP. It covers auth, the pairing link, metadata and chapters, AAC/Opus/MP4 downloads checked with `ffprobe`, byte-exact Range serving on a kept-alive connection, CORS, lists, playlists, dead links and retry, video on request, keep-on-server eviction, two devices agreeing, removal (including mid-download), and a restart that fetches nothing twice.
- **`e2e/web.e2e.js`** drives the exported web app in Chromium behind a Caddy-like proxy: connecting, wrong token, the pairing QR, pasting a list, adding a link twice, dragging a row, the server going away and coming back, playing, chapters, speed, skip, pause, the synced transcript, the queue ending with no wrap, History, the row menu, and two browsers sharing one queue — with zero console errors.

To run the browser half against the dev setup instead: `APP_URL=http://localhost:8081 SERVER_PORT=3000 bun run e2e:web` while `bun run web` is up (nothing else on :3000). It needs Chromium once: `bunx playwright install chromium`.

### Android build

Native modules (track player, sqlite, video, share intent) mean a development build, not Expo Go. The Expo way, no local JDK:

```sh
cd app
bunx eas login
bun run build:dev                   # eas build --profile development --platform android → an APK
bun run start                       # then open the dev build and point it at this server
```

**Straight to a phone on USB** (USB debugging on, JDK 17 and the Android SDK installed):

```sh
cd app
JAVA_HOME=/path/to/jdk-17 bunx expo run:android --variant release --no-bundler
adb reverse tcp:3000 tcp:3000       # the phone's localhost:3000 is now this computer's server
```

That generates `app/android/` (gitignored — it is rebuilt from `app.json`), builds for the phone's CPU only, installs and opens it. The release build carries its own JavaScript, so it runs with no computer attached; on the phone, Settings → Server → `localhost:3000` (over USB) or the LAN address the server prints, and the token.

Plain `http://` is allowed (`expo-build-properties` → `usesCleartextTraffic`) because a self-hosted server on a home network usually has no certificate. Behind Caddy it is HTTPS anyway.

**Battery and memory on Android 16/17**, kept to what matters:
- Playback is media3 in a `mediaPlayback` foreground service (no timeout), with media3 owning audio focus (`autoHandleInterruptions`) — the path Android 17's background-audio hardening expects — and a CPU wake lock only while playing (`androidWakeMode: 1`; audio wake locks don't count against Play's "excessive wake locks").
- The sync socket closes when the app goes to the background and reopens on return; playback, positions and "what's next" carry on from the local store meanwhile.
- Background downloads are a WorkManager job (`expo-background-task`, at most every 30 min, 8-minute budget) that respects *Only on Wi‑Fi*.
- Release builds are R8-minified and resource-shrunk, arm64 only (`expo-build-properties`).

## Self-host

```sh
curl -O https://raw.githubusercontent.com/SamDc73/murmur/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/SamDc73/murmur/main/.env.example
# edit .env: DOMAIN, MURMUR_TOKEN
docker compose up -d                # later: docker compose pull && docker compose up -d
```

Compose pulls two images that CI builds on every push to `main`, for amd64 and arm64: `ghcr.io/samdc73/murmur-server` (the server bundled into one file, with yt-dlp and ffmpeg) and `ghcr.io/samdc73/murmur-web` (Caddy with the web app). Caddy serves the web app on `https://DOMAIN`, proxies `/api` and `/sync` to the server, and gets TLS itself. On a home network with no DNS name, set `DOMAIN=:80` and `PUBLIC_URL=http://<the box's address>` for plain HTTP. The `data` volume holds `murmur.sqlite` and `media/` — back that up and you have everything.

**The Android app** is built on every push too: the newest is always at `https://github.com/SamDc73/murmur/releases/download/latest/murmur.apk`, and each build's APK is attached to its Actions run. Installing a newer one updates the app in place. (It's signed with Expo's public development key — fine for sideloading your own phone, not for a store.)

**Connecting clients.** The web app is served by the server, so it knows its URL: open `https://DOMAIN`, enter the token, Save. The status line turns to *Connected*. A phone scans instead of typing: on the web app, Settings → *Pair a phone* shows a QR code; on the phone, Settings → the scan icon beside *Address*. The same QR is printed in the server's log at startup (`docker compose logs server`), and the code is also a link, `murmur://pair?server=…&token=…`, which opens the app when tapped on the phone.

The token lives only in `.env`. There is no screen to create or change it, on purpose: rotate it there, restart, re-pair.

**If downloads fail with "Sign in to confirm you're not a bot"**: YouTube does that to datacenter IPs. Export a `cookies.txt` (Netscape format) from a logged-in browser and put it at `/data/cookies.txt` in the volume; the server picks it up on the next download. `YTDLP_ARGS` passes anything else (a proxy, say). yt-dlp solves YouTube's player challenges with the image's own Bun (`/etc/yt-dlp.conf`).

## Settings, briefly

- **Server** — the URL (a fact, not a field, when the web app is served by the server), the token, *Pair a phone* on the web, a scan icon beside the address on the phone.
- **Video** — off (audio only, the default) or 480/720/1080p. Any single episode can get its video later from its menu; the Now Playing screen then offers *watch*.
- **Audio format** — m4a or opus; no re-encode when YouTube has that codec.
- **Keep a copy on the server** — see above. Shown once a phone has synced.
- **Devices** — everything that has synced with this store, and when it was last seen.
- **This phone** — auto-download, Wi‑Fi only, delete after playing (the episode stays in History).

Playback has no settings. Speed is a dropdown on the player; skips are 15 s back and 30 s forward everywhere, including the notification.

## Known edges

- The player is `react-native-track-player` **5.0.0-alpha0**, pinned. 4.1.2 (the last stable) is not a New Architecture module: React Native 0.86 refuses its Android methods at startup ("TurboModule system assumes returnType == void"). 5.0 is the maintainers' rewrite on codegen and media3, with the same JavaScript API for everything Murmur uses. Its compiled web build is broken (it imports a stale 4.x copy left in the package), so `app/metro.config.js` points the web bundle at the package's own TypeScript source. Move to 5.0 stable when it ships and drop that.
- The web app streams from the server and stores nothing; there is no offline web.
- Transcripts come from the server; a phone with no server has none.
