import { Platform, useWindowDimensions } from "react-native"

// A rem, in pixels, for the few sizes worked out in code: the browser's 16;
// on a phone the styles are compiled at 14.
export const REM = Platform.OS === "web" ? 16 : 14

// Past a page's width (φ⁸ rem, --container-page) the rail replaces the
// bottom bar.
export function useWide() {
	return useWindowDimensions().width >= 46.98 * REM
}
