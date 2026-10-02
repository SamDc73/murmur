import { usePathname, useRouter } from "expo-router"
import { Pressable, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTokenColour } from "../lib/use-token-colour"
import { HistoryGlyph, QueueGlyph, SettingsGlyph } from "./icons/Glyphs"
import { MurmurGlyph } from "./icons/MurmurGlyph"
import { Icon } from "./ui/Icon"
import { Text } from "./ui/Text"

// Three places. A rail on wide screens, a bar under the mini player on a phone.
// Verdigris is the logo's resting ball: the mark always has it, and the
// Queue's icon gets it only while it's the place you're in.
const PLACES = [
	{ name: "index", href: "/", label: "Queue", glyph: QueueGlyph },
	{ name: "history", href: "/history", label: "History", glyph: HistoryGlyph },
	{ name: "settings", href: "/settings", label: "Settings", glyph: SettingsGlyph },
]

function activeName(pathname) {
	if (pathname === "/" || pathname === "") return "index"
	return pathname.replace(/^\//, "").split("/")[0]
}

export function Rail() {
	const insets = useSafeAreaInsets()
	const current = activeName(usePathname())
	const verdigris = useTokenColour("--color-tertiary")
	return (
		<View
			className="w-rail gap-3xs border-r border-outline-variant bg-surface px-sm pb-md"
			style={{ paddingTop: insets.top + 20 }}
		>
			<View className="flex-row items-center gap-xs px-sm pb-lg">
				<Icon as={MurmurGlyph} accent={verdigris} className="h-icon-xl w-icon-xl text-primary" />
				<Text className="font-display-medium text-subheading">Murmur</Text>
			</View>
			{PLACES.map((place) => (
				<RailItem key={place.name} place={place} active={place.name === current} />
			))}
		</View>
	)
}

function RailItem({ place, active }) {
	const router = useRouter()
	const verdigris = useTokenColour("--color-tertiary")
	return (
		<Pressable
			onPress={() => router.navigate(place.href)}
			accessibilityRole="tab"
			accessibilityState={{ selected: active }}
			className={
				active
					? "flex-row items-center gap-sm rounded-seg bg-primary-wash px-sm py-navitem"
					: "flex-row items-center gap-sm rounded-seg px-sm py-navitem active:bg-surface-container hover:bg-surface-container"
			}
		>
			<Icon
				as={place.glyph}
				accent={active ? verdigris : undefined}
				className={active ? "h-icon w-icon text-primary" : "h-icon w-icon text-on-surface-variant"}
			/>
			<Text variant="line" className={active ? "font-body-semibold text-primary" : "text-on-surface-variant"}>
				{place.label}
			</Text>
		</Pressable>
	)
}

export function Bar({ state }) {
	const insets = useSafeAreaInsets()
	const current = state.routes[state.index].name
	return (
		<View className="flex-row bg-surface px-2xs pt-2xs" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
			{PLACES.map((place) => (
				<BarItem key={place.name} place={place} active={place.name === current} />
			))}
		</View>
	)
}

function BarItem({ place, active }) {
	const router = useRouter()
	const verdigris = useTokenColour("--color-tertiary")
	return (
		<Pressable
			onPress={() => router.navigate(place.href)}
			accessibilityRole="tab"
			accessibilityState={{ selected: active }}
			className="flex-1 items-center gap-3xs rounded-seg py-xs active:bg-surface-container"
		>
			<View className={active ? "rounded-xl bg-primary-wash px-md py-3xs" : "px-md py-3xs"}>
				<Icon
					as={place.glyph}
					accent={active ? verdigris : undefined}
					className={active ? "h-icon-lg w-icon-lg text-primary" : "h-icon-lg w-icon-lg text-on-surface-variant"}
				/>
			</View>
			<Text className={active ? "font-body-semibold text-tab text-primary" : "text-tab text-on-surface-variant"}>
				{place.label}
			</Text>
		</Pressable>
	)
}
