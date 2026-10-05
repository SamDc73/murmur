import { cva } from "class-variance-authority"
import { Pressable } from "react-native"
import { cn } from "./cn"
import { Icon } from "./Icon"

// A round pressable holding one icon: the transport controls, the paste
// button, the "more" dots. Each size is its glyph × φ^1.5 (tokens.css), and
// the stroke thins as the glyph grows, so every size weighs the same.
// `lg` is the one big one a screen has.
const buttonVariants = cva("items-center justify-center rounded-full active:opacity-80", {
	variants: {
		variant: {
			plain: "",
			filled: "bg-primary",
		},
		size: {
			sm: "h-tap w-tap",
			md: "h-tap-lg w-tap-lg",
			lg: "h-play w-play",
		},
	},
	defaultVariants: { variant: "plain", size: "md" },
})

const iconVariants = cva("", {
	variants: {
		variant: {
			plain: "text-on-surface",
			filled: "text-on-primary",
		},
		size: {
			sm: "h-icon w-icon",
			md: "h-icon-lg w-icon-lg",
			lg: "h-icon-xl w-icon-xl",
		},
	},
	defaultVariants: { variant: "plain", size: "md" },
})

const STROKE = { sm: 2, md: 1.75, lg: 1.5 }

export function IconButton({ as, label, variant, size, className, iconClassName, disabled, ...props }) {
	return (
		<Pressable
			role="button"
			accessibilityLabel={label}
			disabled={disabled}
			hitSlop={6}
			className={cn(buttonVariants({ variant, size }), disabled && "opacity-40", className)}
			{...props}
		>
			<Icon as={as} className={cn(iconVariants({ variant, size }), iconClassName)} strokeWidth={STROKE[size ?? "md"]} />
		</Pressable>
	)
}
