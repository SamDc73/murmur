import { useQuery } from "@tanstack/react-query"
import { useLocal } from "./hooks"
import { LOCAL_KEYS } from "./local"

// What the app asks the server over HTTP (everything else is the synced
// store): a transcript, cached by TanStack Query once fetched.

function useServer() {
	const serverUrl = useLocal(LOCAL_KEYS.serverUrl)
	const token = useLocal(LOCAL_KEYS.token)
	const headers = token ? { Authorization: `Bearer ${token}` } : {}
	return { serverUrl, token, get: (path) => fetch(`${serverUrl}${path}`, { headers }) }
}

async function json(response) {
	if (!response.ok) throw new Error(response.status === 401 ? "wrong password" : `HTTP ${response.status}`)
	return response.json()
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
