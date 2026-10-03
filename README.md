# Murmur

Paste YouTube links — one, a whole list, or a Google Doc full of them — and listen like a podcast queue: top to bottom, then it stops. Self-hosted.

- Your server fetches everything with yt-dlp; the phone and the web app share one queue, live.
- The phone keeps its own copies, so it plays without the server; downloads go to the server, the phone, or both.
- Plays in the background with lock-screen, notification and headset controls. Audio by default, video when you want it.
- Chapters, a synced transcript, the description. History of everything played.

## Run it

```sh
curl -O https://raw.githubusercontent.com/SamDc73/murmur/main/docker-compose.yml
docker compose up -d
```

Then open `http://<server address>`. The settings are in `docker-compose.yml`:

- `DOMAIN`: `:80` is plain HTTP on a home network; a public name (`murmur.example.com`) gets HTTPS by itself.
- `MURMUR_TOKEN`: a password. Leave it empty at home; set a long random one if the internet can reach the server. Then each browser asks for it once, and phones get it from the pairing code.
- `PUBLIC_URL`: where phones reach the server, for the pairing code in `docker compose logs server`.
- `SERVER_NAME`, `YTDLP_ARGS`: what the apps call it; extra yt-dlp flags.

If YouTube asks you to sign in, put a `cookies.txt` in the `data` volume.

## Phone

Install [the latest APK](https://github.com/SamDc73/murmur/releases/download/latest/murmur.apk), then scan the QR code from the web app's Settings → Pair a phone (or the server log).

## API

With a token set, send it as `Authorization: Bearer <token>`:

```
GET    /api/queue        the queue, in order
GET    /api/history      played, newest first
POST   /api/queue        any text with YouTube or Google Docs links
PATCH  /api/queue/:id    {"index": 0} moves it · {"played": true} or false
DELETE /api/queue/:id
```

`curl -H "Authorization: Bearer $TOKEN" -d "https://youtu.be/jNQXAC9IVRw" http://<server>/api/queue`

## Develop

```sh
bun install
bun run dev        # server on :3000, web app on :8081
bun run lint       # Biome, ESLint, knip
bun run test       # unit tests
bun run e2e        # end to end, real YouTube
```

Every push builds the Docker images (amd64, arm64) and the APK. What's next: [later.md](later.md).
