import { useCameraPermissions } from "expo-camera"
import { useRouter } from "expo-router"
import ScanQrCode from "lucide-react-native/icons/scan-qr-code"
import { Linking } from "react-native"
import { toast } from "../lib/toast"
import { IconButton } from "./ui/IconButton"

// Settings' scan icon: Android asks for the camera first (the first time),
// then the scanner opens. If the camera was turned off for good, the way
// back is the app's system settings. Phones only — the web file draws nothing.
export function ScanButton() {
	const router = useRouter()
	const [permission, requestPermission] = useCameraPermissions()

	async function scan() {
		const answer = permission?.granted ? permission : await requestPermission()
		if (answer.granted) {
			router.push("/pair")
			return
		}
		if (!answer.canAskAgain) {
			toast("Murmur can’t use the camera", { action: { label: "Settings", onClick: () => Linking.openSettings() } })
		}
	}

	return (
		<IconButton
			as={ScanQrCode}
			size="sm"
			label="Scan a pairing code"
			onPress={scan}
			iconClassName="text-on-surface-variant"
		/>
	)
}
