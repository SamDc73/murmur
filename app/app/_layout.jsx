import { PortalHost } from "@rn-primitives/portal"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useFonts } from "expo-font"
import { Stack, useRouter } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"
import { Platform } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { registerDownloadTask } from "../downloads/task"
import { useShareIntent } from "../lib/share-intent"
import { Toaster } from "../lib/toast"
import { useTokenColour } from "../lib/use-token-colour"
import { useActions, useLocal } from "../store/hooks"
import { LOCAL_KEYS } from "../store/local"
import { StoreProvider } from "../store/StoreProvider"
import { useSync } from "../store/sync"
import { FONTS } from "../theme/fonts"
import "../global.css"

SplashScreen.preventAutoHideAsync().catch(() => undefined)
// Once per launch, before anything renders (a no-op on the web).
registerDownloadTask()

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0, refetchOnWindowFocus: false } } })

export default function Root() {
	const [fontsLoaded] = useFonts(FONTS)
	if (!fontsLoaded) return null
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<QueryClientProvider client={queryClient}>
					<StoreProvider>
						<Boot />
						<Shell />
						{/* Menus and dialogs render here, above everything. */}
						<PortalHost />
						<Toaster position="top-center" />
					</StoreProvider>
				</QueryClientProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	)
}

// Things that run for the life of the app and draw nothing.
function Boot() {
	useSync()
	const { addText } = useActions()
	const router = useRouter()
	const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent()

	useEffect(() => {
		SplashScreen.hideAsync().catch(() => undefined)
	}, [])

	useEffect(() => {
		if (!hasShareIntent) return
		const text = shareIntent?.webUrl || shareIntent?.text || ""
		addText(text)
		resetShareIntent()
		router.navigate("/")
	}, [hasShareIntent, shareIntent, addText, resetShareIntent, router])

	return null
}

function Shell() {
	const background = useTokenColour("--color-background")
	// Turned away by a server with a password, the web app has nothing to show
	// but the sign-in screen. A phone still plays what it holds, and asks for
	// the password in Settings.
	const signedOut = useLocal(LOCAL_KEYS.syncState) === "locked" && Platform.OS === "web"
	return (
		<>
			<StatusBar style="auto" />
			<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}>
				<Stack.Protected guard={!signedOut}>
					<Stack.Screen name="(tabs)" />
					<Stack.Screen name="now" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
					<Stack.Screen name="pair" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
				</Stack.Protected>
				<Stack.Protected guard={signedOut}>
					<Stack.Screen name="sign-in" />
				</Stack.Protected>
			</Stack>
		</>
	)
}
