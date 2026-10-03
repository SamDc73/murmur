# Murmur

Paste YouTube links — one, a whole list, or a Google Doc full of them — and listen like a podcast queue: top to bottom, then it stops. Self-hosted.

- Your server fetches everything with yt-dlp; the phone and the web app share one queue, live.
- The phone keeps its own copies, so it plays without the server; downloads go to the server, the phone, or both.
- Plays in the background with lock-screen, notification and headset controls. Audio by default, video when you want it.
- Chapters, a synced transcript, the description. History of everything played.

## Run it

```sh
curl -O https://raw.githubusercontent.com/SamDc73/murmur/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/SamDc73/murmur/main/.env.example   # set DOMAIN and MURMUR_TOKEN
docker compose up -d
```

On a home network without a domain: `DOMAIN=:80` and `PUBLIC_URL=http://<server address>`. If YouTube asks you to sign in, put a `cookies.txt` in the `data` volume.

## Phone

Install [the latest APK](https://github.com/SamDc73/murmur/releases/download/latest/murmur.apk), then scan the QR code from the web app's Settings → Pair a phone (or the server log).

## API

Same token, as `Authorization: Bearer <token>`:

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
cp server/.env.example server/.env
bun run dev        # server on :3000, web app on :8081
bun run lint       # Biome, ESLint, knip
bun run test       # unit tests
bun run e2e        # end to end, real YouTube
```

Every push builds the Docker images (amd64, arm64) and the APK. What's next: [later.md](later.md).
