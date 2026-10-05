import { cva } from "class-variance-authority"
import { TextInput } from "react-native"
import { useTokenColour } from "../../lib/use-token-colour"
import { cn } from "./cn"

// react-native-reusables' textarea, converted to tokens like Input: React
// Native's own multi-line TextInput, text from the top. Two looks:
// `field`, the kit's filled box; `page`, no box at all — words straight on
// the surface, set like the text around it (the Now screen's note). The
// caret and the selection take the primary colour; the placeholder, outline.
// (Values only, so they come through the live-token hook.)
const textarea = cva("font-body text-on-surface web:outline-none web:resize-none", {
	variants: {
		variant: {
			field: "rounded-xs border border-outline-variant bg-surface px-sm py-xs text-body web:focus:border-primary",
			page: "bg-transparent px-sm py-xs text-line leading-relaxed",
		},
	},
	defaultVariants: { variant: "field" },
})

export function Textarea({ className, variant, ...props }) {
	const placeholder = useTokenColour("--color-outline")
	const primary = useTokenColour("--color-primary")
	return (
		<TextInput
			className={cn(textarea({ variant }), props.editable === false ? "opacity-50" : null, className)}
			multiline
			textAlignVertical="top"
			underlineColorAndroid="transparent"
			placeholderTextColor={placeholder}
			cursorColor={primary}
			selectionColor={primary}
			{...props}
		/>
	)
}
