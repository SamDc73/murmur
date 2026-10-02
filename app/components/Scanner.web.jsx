import { View } from "react-native"
import { Text } from "./ui/Text"

// A browser does not pair by camera; it is usually the screen showing the code.
export function Scanner() {
	return (
		<View className="gap-sm">
			<Text variant="line">Scanning is for the phone app.</Text>
		</View>
	)
}
