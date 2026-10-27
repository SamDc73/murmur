// react-native-track-player opens the app from its media notification with an
// explicit VIEW intent carrying `trackplayer://notification.click` (its
// MusicService pins this as the session activity). Expo Router has no route for
// it and would show its "page not found" screen; a notification tap should land
// on the episode page instead. This runs before routing, outside the React
// tree, for both a cold tap (app launched) and a warm one (app resumed).
export function redirectSystemPath({ path }) {
	// `path` is not guaranteed to be a path or a valid URL, so match on the text.
	if (typeof path === "string" && path.includes("notification.click")) return "/now"
	return path
}
