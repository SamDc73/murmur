import { useRouter } from "expo-router"
import CircleAlert from "lucide-react-native/icons/circle-alert"
import { Pressable, View } from "react-native"
import { useLocal } from "../store/hooks"
import { LOCAL_KEYS } from "../store/local"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"

// One line under the header when links can't reach the server — where it is
// looking, and why it failed — instead of rows that quietly wait. Tap it to
// fix it in Settings. Says nothing while connected or while connecting.
export function ServerNotice({ hasItems }) {
	const router = useRouter()
	const state = useLocal(LOCAL_KEYS.syncState)
	const serverUrl = useLocal(LOCAL_KEYS.serverUrl)
	const error = useLocal(LOCAL_KEYS.lastSyncError)

	let title = ""
	let detail = ""
	if (state === "off" && hasItems) {
		title = "No server yet"
		detail = "Links wait here until one is set in Settings."
	} else if (state === "locked") {
		title = error ? "The server turned down the password" : "The server wants its password"
		detail = "It’s MURMUR_PASSWORD in the server’s docker-compose.yml. Enter it in Settings."
	} else if (state === "offline") {
		title = `Can’t reach ${serverUrl.replace(/^https?:\/\//, "")}`
		detail = error === "server unreachable" ? "Is the server running? Check the address in Settings." : error
	}
	if (!title) return null

	return (
		<Pressable
			onPress={() => router.navigate("/settings")}
			accessibilityRole="button"
			className="mx-auto mb-sm w-full max-w-page px-md"
		>
			<View className="flex-row items-center gap-sm rounded-seg border border-error-line bg-error-wash px-sm py-xs active:opacity-80">
				<Icon as={CircleAlert} className="h-icon w-icon text-error" />
				<View className="flex-1 gap-3xs">
					<Text variant="label" className="font-body-semibold text-error">
						{title}
					</Text>
					<Text variant="caption" className="text-on-surface-variant">
						{detail}
					</Text>
				</View>
			</View>
		</Pressable>
	)
}
