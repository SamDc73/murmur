import X from "lucide-react-native/icons/x"
import { View } from "react-native"
import { IconButton } from "./ui/IconButton"
import { Text } from "./ui/Text"

// A browser pairs by showing the code, not by scanning one.
export function Scanner({ onClose }) {
	return (
		<View className="flex-1 items-center justify-center gap-md bg-background px-xl">
			<IconButton as={X} size="md" label="Close" onPress={onClose} iconClassName="text-on-surface-variant" />
			<Text variant="line" className="text-center">
				Scanning is for the phone app. Here, Settings → Pair a phone shows the code to scan.
			</Text>
		</View>
	)
}
