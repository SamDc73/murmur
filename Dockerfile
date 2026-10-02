# syntax=docker/dockerfile:1
# Two images from one file, picked by `target:` in docker-compose.yml:
#   server — the server bundled into one file, on Bun, with yt-dlp and ffmpeg.
#   web    — Caddy with the exported web app baked in; proxies /api and /sync.
# Both build for amd64 and arm64.

# ---- build: install the workspace, export the web app, bundle the server ----
# Runs once, on the builder's own architecture: its output is JavaScript.
# Bun matches package.json's packageManager, the version the lockfile is tested with.
FROM --platform=$BUILDPLATFORM docker.io/oven/bun:1.2.23 AS build
WORKDIR /src
ENV CI=1 EXPO_NO_TELEMETRY=1 DO_NOT_TRACK=1

COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/
COPY app/package.json app/
COPY server/package.json server/
RUN bun install --frozen-lockfile

COPY . .
RUN cd app && bunx expo export --platform web
# The server and everything it imports, as one file: the server image needs
# no node_modules at all.
RUN bun build server/src/index.js --target=bun --outfile=server/dist/index.js

# ---- server ---------------------------------------------------------------
FROM docker.io/oven/bun:1.2.23-slim AS server
ARG TARGETARCH
# ffmpeg remuxes what yt-dlp fetches. The standalone yt-dlp carries its own
# Python, and solves YouTube's player challenges with the Bun already here.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
	&& case "$TARGETARCH" in \
		amd64) YT=yt-dlp_linux ;; \
		arm64) YT=yt-dlp_linux_aarch64 ;; \
		*) echo "unsupported architecture: $TARGETARCH"; exit 1 ;; \
	esac \
	&& curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$YT" -o /usr/local/bin/yt-dlp \
	&& chmod +x /usr/local/bin/yt-dlp \
	&& printf -- "--js-runtimes bun\n" > /etc/yt-dlp.conf \
	&& apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/* \
	&& yt-dlp --version
WORKDIR /app
COPY --from=build /src/server/dist/index.js ./index.js
ENV PORT=3000 DATA_DIR=/data
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD bun -e "fetch('http://localhost:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1))"
CMD ["bun", "index.js"]

# ---- web: Caddy + the static export -----------------------------------------
FROM docker.io/library/caddy:2 AS web
COPY --from=build /src/app/dist /srv/www
COPY Caddyfile /etc/caddy/Caddyfile
