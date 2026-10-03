# Later

Things deliberately left out of the first cut, roughly in the order they were asked for.

## Sources
- **Spotify links.** Paste a Spotify episode/show URL. No download path exists that respects their terms; the honest version is "open in Spotify" plus queue bookkeeping, or matching the episode to a YouTube upload.
- **Subscriptions.** Follow a YouTube channel or playlist: the server polls the channel RSS (`https://www.youtube.com/feeds/videos.xml?channel_id=…`) or `yt-dlp --flat-playlist` on a cron, and queues new uploads.
- **Rules.** A cron on the server with filters — channel, title regex, minimum length, playlist — that decide what gets queued and where it lands (top / end). This is the "real uplevel stuff": one rules table, one scheduler, one dry-run view.
- **Other sites.** yt-dlp handles hundreds; the phone-side link parser only recognises YouTube. Widen `parseYouTubeUrl` into `parseLink` with a generic fallback.
- **Local files / RSS podcasts.** Real podcast feeds (enclosures) — the same pipeline without yt-dlp.

## Downloads with the app closed
- **The WorkManager job doesn't always reach JavaScript.** On a Pixel 10 (Android 17), with track-player 5 alpha: forcing the job (`adb shell cmd jobscheduler run -f dev.murmur.app <id>`) ran the task end to end once; in later runs Android started it ("Executing task 'murmur-downloads'", "Started headless task 2…") but the JS executor never ran. Suspect the interplay of Expo's headless task with the player service's own headless task. Meanwhile the app downloads whenever it is open, and again whenever the connection changes. Next step: trace expo-task-manager's JS event delivery, or move the job to a plain WorkManager worker (no JS), or wait for track-player 5 stable.

## Playback
- **Home-screen widget** (Glance). The media notification, lock screen and quick-settings output switcher already exist through the media session; a widget is separate work.
- **Sleep timer**, **silence trimming**, **volume boost** — ExoPlayer supports the last two.
- **Android Auto / Wear** — RNTP exposes a media browser; needs a browse tree.
- **Position sync mid-play** across devices is every 5 s; a "continue on this device" handoff prompt would make it feel like Spotify Connect.
- **Trim intro/outro per channel** ("skip the first 90 s of channel X").

## Settings
- **Playback preferences** (skip amounts, default speed) were removed on purpose; speed lives on the player. Add back only if 15/30 s turns out wrong for someone.
- **Forget a device** from the Devices list, so a phone that was wiped stops counting as a holder of files.

## Queue
- **Multi-select** (remove / move several).
- **Per-item download target** (the setting is global).
- **Smart queue** ("shortest first", "oldest first") as a one-tap sort.

## Files
- **Server storage policy**: purge history files after N days, cap total size, keep the last N.
- **Transcode on device** for space (opus).
- **Thumbnails cached on the server** for a fully offline web app.
- **Export / import** the queue and history as JSON.

## Server
- **Per-device tokens.** Today every client holds the one `MURMUR_PASSWORD`; the pairing QR just carries it. The upgrade, when cutting off a single phone matters: the web issues a five-minute pairing code, the phone trades it for its own token, and the Devices list gets a Revoke. (Nextcloud app passwords, Home Assistant long-lived tokens, Memos PATs all work this way.)
- **Cookies UI**: paste a Netscape cookies file in Settings and send it to the server, instead of copying it into the data volume by hand. YouTube's bot check on datacenter IPs is the single most likely thing to break downloads.
- **Multi-user** (one token per person, one store each).
- **Push** when a download finishes or a subscription finds something (ntfy is a natural fit and was in the old compose file).
- **Metrics page**: queue hours over time, listened per week.

## On-device extraction
- Rejected for this cut on purpose (server-only extraction is more robust). If it is wanted later: `youtubei.js` in the app, with its own copy rows, so a phone can queue-and-fetch with no server at all.

## Platform
- **targetSdk 37** (Android 17): `usesCleartextTraffic` is on its way out — expect to need TLS (or a network-security config per host) for a LAN server — and reaching a LAN address will need the `ACCESS_LOCAL_NETWORK` permission. Background audio must then be started while the app is visible (it already is: play comes from the screen, the notification or a headset).
- **Battery-saver aware downloads**: skip the background download job in low-power mode (`expo-battery`), and offer audio offload (`android.audioOffload`) for long screen-off listening at 1×.
- **iOS**: the code is platform-neutral, but the share extension, background task rules, and RNTP audio session need config and testing.
- **Highlights** (Snipd-style): the timed transcript is already there; a "snip the last 30 s" action is a small step from it. Search inside a transcript is another.
- **Transcripts on a standalone phone**: today they are fetched from the server when shown. Downloading the transcript with the episode would make them work offline.
