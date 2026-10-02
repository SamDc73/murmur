import { pairLink, parsePairLink } from "@murmur/core"
import { useLocalSearchParams, useRouter } from "expo-router"
import ChevronDown from "lucide-react-native/icons/chevron-down"
import { useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Scanner } from "../components/Scanner"
import { Button } from "../components/ui/Button"
import { IconButton } from "../components/ui/IconButton"
import { Text } from "../components/ui/Text"
import { useActions } from "../store/hooks"

// Joining a server. Two ways in, one route:
//   murmur://pair?server=…&token=…   a tapped link arrives with its params
//   /pair                            the camera, for a code on another screen
export default function PairScreen() {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const params = useLocalSearchParams()
	const { pair } = useActions()
	const [scanError, setScanError] = useState("")

	function accept(text) {
		const parsed = parsePairLink(text)
		if (parsed === null) {
			setScanError(NOT_A_CODE)
			return
		}
		pair(parsed)
		router.replace("/settings")
	}

	// A tapped link opened the app: its query is the code, so join at once. A
	// bad link is known while rendering; only a good one does anything.
	const fromLink =
		typeof params.server === "string"
			? pairLink(params.server, typeof params.token === "string" ? params.token : "")
			: ""
	const badLink = fromLink !== "" && parsePairLink(fromLink) === null
	useEffect(() => {
		const parsed = parsePairLink(fromLink)
		if (parsed === null) return
		pair(parsed)
		router.replace("/settings")
	}, [fromLink, pair, router])
	const error = badLink ? NOT_A_CODE : scanError

	return (
		<View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
			<View className="mx-auto w-full max-w-page flex-row items-center justify-between px-sm py-2xs">
				<IconButton
					as={ChevronDown}
					size="md"
					label="Close"
					onPress={() => router.back()}
					iconClassName="text-on-surface-variant"
				/>
				<Text variant="eyebrow">pair with a server</Text>
				<View className="h-tap-lg w-tap-lg" />
			</View>
			<View className="mx-auto w-full max-w-page flex-1 gap-md px-lg pt-sm">
				{fromLink && !badLink ? <Text variant="line">Connecting…</Text> : <Scanner onCode={accept} />}
				{error ? (
					<Text variant="label" className="text-error">
						{error}
					</Text>
				) : null}
				<Text variant="caption" className="text-on-surface-variant">
					The code is in the web app under Settings → Pair a phone, and in the server’s log when it starts.
				</Text>
				<Button variant="outlined" onPress={() => router.back()}>
					<Text>Type it instead</Text>
				</Button>
			</View>
		</View>
	)
}

const NOT_A_CODE = "That is not a Murmur pairing code."
