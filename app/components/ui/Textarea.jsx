import { TextInput } from "react-native"
import { useTokenColour } from "../../lib/use-token-colour"
import { cn } from "./cn"

// react-native-reusables' textarea, converted to tokens like Input: React
// Native's own multi-line TextInput, text from the top. The caret and the
// selection take the primary colour; the placeholder, outline. (Values only,
// so they come through the live-token hook.)
export function Textarea({ className, ...props }) {
	const placeholder = useTokenColour("--color-outline")
	const primary = useTokenColour("--color-primary")
	return (
		<TextInput
			className={cn(
				"rounded-seg border border-outline-variant bg-surface px-sm py-xs font-body text-body text-on-surface web:outline-none web:focus:border-primary",
				props.editable === false ? "opacity-50" : null,
				className
			)}
			multiline
			textAlignVertical="top"
			placeholderTextColor={placeholder}
			cursorColor={primary}
			selectionColor={primary}
			{...props}
		/>
	)
}
