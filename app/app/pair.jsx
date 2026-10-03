import { pairLink, parsePairLink } from "@murmur/core"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { View } from "react-native"
import { Scanner } from "../components/Scanner"
import { Text } from "../components/ui/Text"
import { useActions } from "../store/hooks"

// Joining a server. Two ways in, one route:
//   murmur://pair?server=…&token=…   a tapped link arrives with its params
//   /pair                            the camera, full screen
export default function PairScreen() {
	const router = useRouter()
	const params = useLocalSearchParams()
	const { pair } = useActions()
	const [scanError, setScanError] = useState("")

	// A scanned code: pair and go back to Settings, or say it isn't one.
	function accept(text) {
		const parsed = parsePairLink(text)
		if (parsed === null) {
			setScanError(NOT_A_CODE)
			return false
		}
		pair(parsed)
		router.replace("/settings")
		return true
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

	if (fromLink && !badLink) {
		return (
			<View className="flex-1 items-center justify-center bg-background">
				<Text variant="line">Connecting…</Text>
			</View>
		)
	}
	return <Scanner onCode={accept} onClose={() => router.back()} error={badLink ? NOT_A_CODE : scanError} />
}

const NOT_A_CODE = "That is not a Murmur pairing code."
