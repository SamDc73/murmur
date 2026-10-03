import { CameraView, useCameraPermissions } from "expo-camera"
import { StatusBar } from "expo-status-bar"
import Flashlight from "lucide-react-native/icons/flashlight"
import FlashlightOff from "lucide-react-native/icons/flashlight-off"
import X from "lucide-react-native/icons/x"
import { useRef, useState } from "react"
import { Linking, StyleSheet, useWindowDimensions, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Button } from "./ui/Button"
import { IconButton } from "./ui/IconButton"
import { Text } from "./ui/Text"

const CORNER = 28
const AGAIN_AFTER_MS = 1500

// The camera, full screen, looking for one QR code — the way WhatsApp and
// Signal do it: everything dimmed but a square in the middle, a close button,
// a light, one line of help. The square takes most of the short side, so it
// fits any phone or tablet, either way up. `onCode` says whether the code was
// right; a wrong one can be followed by the right one a moment later.
export function Scanner({ onCode, onClose, error }) {
	const [permission, requestPermission] = useCameraPermissions()
	const [torch, setTorch] = useState(false)
	const seen = useRef(false)
	const { width, height } = useWindowDimensions()
	const insets = useSafeAreaInsets()
	const side = Math.min(width, height) * 0.68
	const left = (width - side) / 2
	const top = (height - side) / 2
	const reach = Math.max(width, height)
	// Under the square, but never below the screen (a phone on its side).
	const below = Math.min(top + side + 24, height - insets.bottom - 96)

	function scanned({ data }) {
		if (seen.current) return
		seen.current = true
		if (!onCode(data)) setTimeout(() => (seen.current = false), AGAIN_AFTER_MS)
	}

	return (
		<View className="flex-1 bg-camera">
			<StatusBar style="light" />
			{permission?.granted ? (
				<CameraView
					style={StyleSheet.absoluteFill}
					facing="back"
					enableTorch={torch}
					barcodeScannerSettings={BARCODES}
					onBarcodeScanned={scanned}
				/>
			) : null}

			{/* The dimming: one border so wide it covers the screen, around a
			    clear rounded square — then the square's own thin outline. */}
			<View
				className="absolute border-camera-veil"
				style={{
					pointerEvents: "none",
					left: left - reach,
					top: top - reach,
					width: side + 2 * reach,
					height: side + 2 * reach,
					borderWidth: reach,
					borderRadius: reach + CORNER,
				}}
			/>
			<View
				className="absolute border-2 border-on-camera"
				style={{ pointerEvents: "none", left, top, width: side, height: side, borderRadius: CORNER }}
			/>

			<View
				className="absolute right-0 left-0 flex-row items-center justify-between px-sm"
				style={{ top: insets.top + 8 }}
			>
				<IconButton as={X} size="md" label="Close" onPress={onClose} iconClassName="text-on-camera" />
				{permission?.granted ? (
					<IconButton
						as={torch ? FlashlightOff : Flashlight}
						size="md"
						label={torch ? "Light off" : "Light on"}
						onPress={() => setTorch((on) => !on)}
						iconClassName="text-on-camera"
					/>
				) : null}
			</View>

			<View className="absolute right-0 left-0 items-center gap-sm px-xl" style={{ top: below }}>
				{permission?.granted ? (
					<Text variant="line" className="text-center text-on-camera">
						{error || "Point at the code in Murmur on the web: Settings → Pair a phone."}
					</Text>
				) : (
					<CameraAsk permission={permission} requestPermission={requestPermission} />
				)}
			</View>
		</View>
	)
}

// Reached without the camera allowed (it was turned off since): ask again,
// or — if Android won't ask any more — point to the app's settings.
function CameraAsk({ permission, requestPermission }) {
	if (!permission) return null
	const again = permission.canAskAgain
	return (
		<>
			<Text variant="line" className="text-center text-on-camera">
				The camera reads the pairing code.
			</Text>
			<Button variant="tonal" onPress={again ? requestPermission : () => Linking.openSettings()}>
				<Text>{again ? "Allow the camera" : "Open settings"}</Text>
			</Button>
		</>
	)
}

const BARCODES = { barcodeTypes: ["qr"] }
