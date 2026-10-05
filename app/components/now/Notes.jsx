import { useEffect, useState } from "react"
import { useDebouncedCallback } from "use-debounce"
import { useActions, useItem } from "../../store/hooks"
import { Textarea } from "../ui/Textarea"

const SAVE_AFTER_MS = 600

// A note on the episode, for yourself: plain text, typed while it plays —
// written straight on the page, set like the About text beside it, no box.
// It is kept a moment after you stop typing (and at once when you leave the
// field), and syncs like everything else. Keyed by episode where it's used,
// so a new episode starts a new note.
export function Notes({ itemId }) {
	const saved = useItem(itemId).note ?? ""
	const { setNote } = useActions()
	// What you're typing, until it's kept; otherwise what's stored — so a note
	// written on another device shows up here.
	const [draft, setDraft] = useState(null)
	const save = useDebouncedCallback((text) => setNote(itemId, text), SAVE_AFTER_MS)
	// Closing the screen mid-sentence still keeps it.
	useEffect(() => () => save.flush(), [save])

	return (
		<Textarea
			value={draft ?? saved}
			onChangeText={(text) => {
				setDraft(text)
				save(text)
			}}
			onBlur={() => {
				save.flush()
				setDraft(null)
			}}
			variant="page"
			placeholder="Write as you listen…"
			accessibilityLabel="Note"
			className="flex-1"
		/>
	)
}
