import { useUnstableNativeVariable } from "nativewind"

// The one sanctioned way to read a token's *value* in JavaScript, for the few
// props that only take a value (placeholderTextColor, a slider's colours, the
// status bar). Reads through NativeWind's variable context. Web has its own file.
export function useTokenColour(name) {
	return useUnstableNativeVariable(name)
}
