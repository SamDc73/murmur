import { CameraView, useCameraPermissions } from "expo-camera"
import { useRef } from "react"
import { View } from "react-native"
import { Button } from "./ui/Button"
import { Text } from "./ui/Text"

// The camera, looking for one QR code. It reports the first code it sees and
// then ignores the rest, so a code held up for a second is not read twice.
export function Scanner({ onCode }) {
	const [permission, requestPermission] = useCameraPermissions()
	const seen = useRef(false)

	if (!permission) return null
	if (!permission.granted) {
		return (
			<View className="gap-sm">
				<Text variant="line">The camera reads the pairing code.</Text>
				<Button variant="tonal" onPress={requestPermission}>
					<Text>Allow the camera</Text>
				</Button>
			</View>
		)
	}
	return (
		<View className="aspect-square w-full overflow-hidden rounded-xl bg-surface-container-lowest">
			<CameraView
				style={{ flex: 1 }}
				facing="back"
				barcodeScannerSettings={BARCODES}
				onBarcodeScanned={({ data }) => {
					if (seen.current) return
					seen.current = true
					onCode(data)
				}}
			/>
		</View>
	)
}

const BARCODES = { barcodeTypes: ["qr"] }
