import { useQuery } from "@tanstack/react-query"
import { useLocal } from "./hooks"
import { LOCAL_KEYS } from "./local"

// What the app asks the server over HTTP (everything else is the synced
// store). Both are cached by TanStack Query: fetched when first shown.

function useServer() {
	const serverUrl = useLocal(LOCAL_KEYS.serverUrl)
	const token = useLocal(LOCAL_KEYS.token)
	const headers = token ? { Authorization: `Bearer ${token}` } : {}
	return { serverUrl, token, get: (path) => fetch(`${serverUrl}${path}`, { headers }) }
}

async function json(response) {
	if (!response.ok) throw new Error(response.status === 401 ? "wrong token" : `HTTP ${response.status}`)
	return response.json()
}

/** yt-dlp's version and the item count, once connected. */
export function useServerInfo(enabled) {
	const server = useServer()
	return useQuery({
		queryKey: ["server-info", server.serverUrl, server.token],
		enabled: Boolean(enabled && server.serverUrl),
		staleTime: 30_000,
		queryFn: () => server.get("/api/info").then(json),
	})
}

/** An episode's transcript: [{ s, e, t }], or undefined while it loads. */
export function useTranscript(itemId, lang) {
	const server = useServer()
	return useQuery({
		queryKey: ["transcript", itemId, lang],
		enabled: Boolean(itemId && lang && server.serverUrl),
		staleTime: Number.POSITIVE_INFINITY,
		queryFn: () =>
			server
				.get(`/api/media/${encodeURIComponent(`${itemId}.transcript.json`)}`)
				.then(json)
				.then((body) => body.cues),
	})
}
