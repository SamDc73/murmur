import { cva } from "class-variance-authority"
import { useContext } from "react"
import { Text as NativeText } from "react-native"
import { cn } from "./cn"
import { TextClassContext } from "./textClass"

// The type roles, and nothing else: Instrument Sans for reading (`body`,
// `line`, `label`, `caption`), Fraunces for the one heading a screen has
// (`heading`, `subheading`), IBM Plex Mono for times, data and eyebrows.
const textVariants = cva("font-body text-on-surface", {
	variants: {
		variant: {
			caption: "text-caption",
			label: "text-label",
			body: "text-body",
			line: "text-line",
			subheading: "font-body-semibold text-subheading",
			heading: "font-display-medium text-heading",
			eyebrow: "font-mono text-eyebrow uppercase tracking-eyebrow text-on-surface-variant",
			mono: "font-mono text-time tabular-nums",
			data: "font-mono-regular text-label tabular-nums text-on-surface-variant",
		},
	},
	defaultVariants: { variant: "body" },
})

export function Text({ className, variant, ...props }) {
	const contextClass = useContext(TextClassContext)
	return <NativeText className={cn(textVariants({ variant }), contextClass, className)} {...props} />
}
