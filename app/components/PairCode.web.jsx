import { pairLink } from "@murmur/core"
import { useColorScheme, View } from "react-native"
import QRCode from "react-qr-code"
import { useTokenColour } from "../lib/use-token-colour"
import { Text } from "./ui/Text"

// What a phone scans to join this server: its address and token, as a QR
// code — and as a link, for a phone that would rather tap it. The code is
// always dark on light, even in the dark theme (where that's the inverse
// surface): plenty of scanners can't read an inverted one.
export function PairCode({ serverUrl, token }) {
	const dark = useColorScheme() === "dark"
	const ink = useTokenColour(dark ? "--color-inverse-on-surface" : "--color-on-surface")
	const paper = useTokenColour(dark ? "--color-inverse-surface" : "--color-surface-container-lowest")
	const link = pairLink(serverUrl, token)
	return (
		<View className="items-center gap-sm px-md py-md">
			<View className={dark ? "rounded-sm bg-inverse-surface p-md" : "rounded-sm bg-surface-container-lowest p-md"}>
				<QRCode value={link} size={184} bgColor={paper} fgColor={ink} level="M" />
			</View>
			<Text variant="caption" className="text-center text-on-surface-variant">
				On the phone: Settings, then the scan icon beside Address.
			</Text>
			<Text variant="caption" selectable className="text-center text-on-surface-variant">
				{link}
			</Text>
		</View>
	)
}
