import * as Clipboard from "expo-clipboard"
import ArrowUp from "lucide-react-native/icons/arrow-up"
import ClipboardPaste from "lucide-react-native/icons/clipboard-paste"
import Plus from "lucide-react-native/icons/plus"
import { useState } from "react"
import { Platform, View } from "react-native"
import { toast } from "../lib/toast"
import { useActions } from "../store/hooks"
import { ConfirmDialog } from "./ui/ConfirmDialog"
import { Icon } from "./ui/Icon"
import { IconButton } from "./ui/IconButton"
import { Input } from "./ui/Input"

// Where links go in: one slim field that takes one link or a whole list.
// Anything already here is asked about before it is added again; what
// happened is said in a toast, so nothing on the screen moves.
export function AddBar() {
	const { planAdd, addPlanned } = useActions()
	const [text, setText] = useState("")
	const [pending, setPending] = useState(null)
	const say = (message) => toast(message)

	function done(result) {
		setText("")
		setPending(null)
		say(summary(result))
	}

	function submit(value) {
		const plan = planAdd(value)
		if (plan.links.length === 0) return say("No YouTube or Google Docs link in that")
		if (plan.queued.length + plan.played.length === 0) return done(addPlanned(plan))
		setPending(plan)
	}

	async function paste() {
		try {
			const value = await Clipboard.getStringAsync()
			if (value) submit(value)
			else say("The clipboard is empty")
		} catch {
			say("Couldn’t read the clipboard")
		}
	}

	// Web: Enter adds, Shift+Enter starts a new line. Phone: return is a new line.
	function keyPress(event) {
		if (Platform.OS !== "web") return
		const { key, shiftKey } = event.nativeEvent
		if (key === "Enter" && !shiftKey) {
			event.preventDefault?.()
			if (text.trim()) submit(text)
		}
	}

	const lines = Math.min(Math.max(text.split("\n").length, 1), 4)
	return (
		<View className="mx-auto w-full max-w-page gap-2xs px-md pb-sm">
			<View className="flex-row items-center gap-2xs rounded-lg border border-outline-variant bg-surface-container-lowest pr-3xs pl-sm web:focus-within:border-primary">
				<Icon as={Plus} className="h-icon w-icon text-outline" />
				<Input
					className="flex-1 border-0 bg-transparent px-0 web:outline-none"
					multiline
					numberOfLines={lines}
					scrollEnabled={lines >= 4}
					textAlignVertical="center"
					placeholder="Add a YouTube link"
					value={text}
					onChangeText={setText}
					onKeyPress={keyPress}
					autoCapitalize="none"
					autoCorrect={false}
					inputMode="url"
					accessibilityLabel="Links to add"
				/>
				{text.trim() ? (
					<IconButton as={ArrowUp} variant="filled" size="sm" label="Add" onPress={() => submit(text)} />
				) : (
					<IconButton
						as={ClipboardPaste}
						size="sm"
						label="Paste"
						onPress={paste}
						iconClassName="text-on-surface-variant"
					/>
				)}
			</View>
			{pending ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setPending(null)
					}}
					{...question(pending, (options) => done(addPlanned(pending, options)))}
				/>
			) : null}
		</View>
	)
}

// The dialog for a paste that holds something already here.
function question(plan, add) {
	const fresh = plan.fresh.length
	const queued = plan.queued.length
	const played = plan.played.length
	const name = (entry) => `“${entry.row.title || entry.link.url}”`

	if (plan.links.length === 1 && queued === 1) {
		return {
			title: "Already in your queue",
			body: name(plan.queued[0]),
			actions: [{ label: "Play next", onPress: () => add({ queuedNext: true }) }],
		}
	}
	if (plan.links.length === 1 && played === 1) {
		return {
			title: "You’ve played this",
			body: name(plan.played[0]),
			actions: [{ label: "Add to queue", onPress: () => add({ requeuePlayed: true }) }],
		}
	}
	const parts = [
		fresh && `${fresh} new`,
		queued && `${queued} already in your queue`,
		played && `${played} played before`,
	]
	const actions = []
	if (fresh > 0) actions.push({ label: `Add ${fresh} new`, onPress: () => add({}) })
	if (played > 0)
		actions.push({ label: fresh > 0 ? "Add all" : `Add ${played} again`, onPress: () => add({ requeuePlayed: true }) })
	if (actions.length === 0) actions.push({ label: "Play next", onPress: () => add({ queuedNext: true }) })
	return { title: "Some of these are already here", body: parts.filter(Boolean).join(" · "), actions }
}

function summary(result) {
	const [added, requeued, moved] = [result.added.length, result.requeued.length, result.moved.length]
	const parts = []
	if (added) parts.push(`Added ${added === 1 ? "one" : added}`)
	if (requeued) parts.push(`${requeued} back from History`)
	if (moved) parts.push(moved === 1 ? "Moved to play next" : `${moved} moved to play next`)
	return parts.join(" · ") || "Nothing to add"
}
