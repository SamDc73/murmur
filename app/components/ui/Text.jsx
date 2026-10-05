import { cva } from "class-variance-authority"
import { useContext } from "react"
import { Text as NativeText } from "react-native"
import { cn } from "./cn"
import { TextClassContext } from "./textClass"

// The type roles, and nothing else: Instrument Sans for reading (`body`,
// `line`, `label`, `caption`), Fraunces for the one heading a screen has
// (`heading`, `subheading`), IBM Plex Mono for times, data and eyebrows.
// Each is a step on the type scale (tokens.css) with its line height: √φ,
// as everything here is set in a line or two — reading text adds
// `leading-relaxed` (φ). Leading comes after size: a size class drops it.
const textVariants = cva("font-body text-on-surface", {
	variants: {
		variant: {
			caption: "text-caption leading-tight",
			label: "text-label leading-tight",
			body: "text-body leading-tight",
			line: "text-line leading-tight",
			subheading: "font-body-semibold text-subheading leading-tight tracking-subheading",
			heading: "font-display-medium text-heading leading-tight tracking-heading",
			eyebrow: "font-mono text-chip leading-tight uppercase tracking-eyebrow text-on-surface-variant",
			mono: "font-mono text-caption leading-tight tabular-nums",
			data: "font-mono-regular text-caption leading-tight tabular-nums text-on-surface-variant",
		},
	},
	defaultVariants: { variant: "body" },
})

export function Text({ className, variant, ...props }) {
	const contextClass = useContext(TextClassContext)
	return <NativeText className={cn(textVariants({ variant }), contextClass, className)} {...props} />
}
