import { cva } from "class-variance-authority"
import { Pressable } from "react-native"
import { cn } from "./cn"
import { TextClassContext } from "./textClass"

// A labelled button: filled, tonal or outlined, in Material 3's words. Put a
// <Text> inside for the label — it takes the matching on-colour through
// TextClassContext, so no call site names a colour.

const buttonVariants = cva("flex-row items-center justify-center gap-xs rounded-seg active:opacity-80", {
	variants: {
		variant: {
			filled: "bg-primary",
			tonal: "bg-secondary-container",
			outlined: "border border-outline",
		},
		size: {
			sm: "px-sm py-2xs",
			md: "px-md py-xs",
		},
	},
	defaultVariants: { variant: "filled", size: "md" },
})

const labelVariants = cva("font-body-semibold text-label", {
	variants: {
		variant: {
			filled: "text-on-primary",
			tonal: "text-on-secondary-container",
			outlined: "text-primary",
		},
	},
	defaultVariants: { variant: "filled" },
})

export function Button({ className, variant, size, disabled, ...props }) {
	return (
		<TextClassContext value={labelVariants({ variant })}>
			<Pressable
				role="button"
				disabled={disabled}
				className={cn(buttonVariants({ variant, size }), disabled && "opacity-50", className)}
				{...props}
			/>
		</TextClassContext>
	)
}
