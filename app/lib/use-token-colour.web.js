import { useColorScheme } from "react-native"

// On the web the tokens are CSS custom properties on :root (Tailwind's @theme
// emits them), so read the computed value. useColorScheme() re-renders the
// caller when the scheme flips, and the next read picks up the new value.
export function useTokenColour(name) {
	useColorScheme()
	if (typeof document === "undefined") return undefined
	const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
	return value === "" ? undefined : value
}
