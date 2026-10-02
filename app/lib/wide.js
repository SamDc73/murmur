import { useWindowDimensions } from "react-native"

// Past this the rail replaces the bottom bar and gutters widen — the
// --breakpoint-wide token in tokens.css (46rem).
const WIDE_PX = 46 * 16

export function useWide() {
	return useWindowDimensions().width >= WIDE_PX
}
