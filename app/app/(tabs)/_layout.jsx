import { Tabs } from "expo-router"
import { View } from "react-native"
import { Dock } from "../../components/Dock"
import { Rail } from "../../components/SectionBar"
import { useTokenColour } from "../../lib/use-token-colour"
import { useWide } from "../../lib/wide"

// The three tabs. On a phone the Dock (mini player + bar) is the tab bar; on
// a wide screen the rail takes over navigation and the Dock keeps only the
// mini player.
export default function TabsLayout() {
	const wide = useWide()
	const background = useTokenColour("--color-background")
	return (
		<View className="flex-1 flex-row bg-background">
			{wide ? <Rail /> : null}
			<View className="flex-1">
				<Tabs
					tabBar={(props) => <Dock {...props} />}
					screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: background }, lazy: false }}
				>
					<Tabs.Screen name="index" options={{ title: "Queue" }} />
					<Tabs.Screen name="history" options={{ title: "History" }} />
					<Tabs.Screen name="settings" options={{ title: "Settings" }} />
				</Tabs>
			</View>
		</View>
	)
}
