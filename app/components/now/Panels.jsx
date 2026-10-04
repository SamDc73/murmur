import { parseChapters } from "@murmur/core"
import { useMemo, useState } from "react"
import { Pressable, View } from "react-native"
import { seekTo } from "../../player/controller"
import { cn } from "../ui/cn"
import { Text } from "../ui/Text"
import { About } from "./About"
import { Chapters } from "./Chapters"
import { Notes } from "./Notes"
import { Transcript } from "./Transcript"

// Below the player (or beside it, on a desktop): what there is to read
// about this episode, one tab at a time — and your note on it. The others
// appear only with something in them.
export function Panels({ itemId, item, className }) {
	const chapters = useMemo(() => parseChapters(item), [item])
	const tabs = [
		chapters.length > 0 && "Chapters",
		item.transcript && "Transcript",
		item.description && "About",
		"Notes",
	].filter(Boolean)
	const [picked, setPicked] = useState(null)
	const [following, setFollowing] = useState(true)
	const tab = tabs.includes(picked) ? picked : tabs[0]

	return (
		<View className={cn("flex-1 gap-2xs", className)}>
			<View className="flex-row items-center gap-md border-b border-outline-variant px-sm">
				{tabs.map((name) => (
					<Pressable
						key={name}
						role="tab"
						accessibilityState={{ selected: name === tab }}
						onPress={() => setPicked(name)}
						className={cn("-mb-px border-b-2 py-xs", name === tab ? "border-primary" : "border-transparent")}
					>
						<Text
							variant="label"
							className={name === tab ? "font-body-semibold text-on-surface" : "text-on-surface-variant"}
						>
							{name}
						</Text>
					</Pressable>
				))}
				<View className="flex-1" />
				{tab === "Transcript" && !following ? (
					<Pressable
						onPress={() => setFollowing(true)}
						className="rounded-full bg-secondary-container px-sm py-3xs active:opacity-80"
					>
						<Text variant="label" className="text-on-secondary-container">
							Follow
						</Text>
					</Pressable>
				) : null}
			</View>
			<View className="flex-1">
				{tab === "Chapters" ? <Chapters chapters={chapters} onSeek={seekTo} /> : null}
				{tab === "Transcript" ? (
					<Transcript
						itemId={itemId}
						lang={item.transcript}
						following={following}
						onFollowingChange={setFollowing}
						onSeek={seekTo}
					/>
				) : null}
				{tab === "About" ? <About text={item.description} /> : null}
				{tab === "Notes" ? <Notes key={itemId} itemId={itemId} /> : null}
			</View>
		</View>
	)
}
