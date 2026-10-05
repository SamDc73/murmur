import { cva } from "class-variance-authority"
import { Pressable } from "react-native"
import { cn } from "./cn"
import { TextClassContext } from "./textClass"

// A labelled button: filled, tonal or outlined, in Material 3's words. Put a
// <Text> inside for the label — it takes the matching on-colour through
// TextClassContext, so no call site names a colour. A pill, like the round
// buttons beside it. Every variant has a hairline border (clear unless
// outlined), so all three stand the same height. `md` is a round button's
// height (tap); `sm` sits inside a row.

const buttonVariants = cva(
	"flex-row items-center justify-center gap-xs rounded-full border border-transparent active:opacity-80",
	{
		variants: {
			variant: {
				filled: "bg-primary",
				tonal: "bg-secondary-container",
				outlined: "border-outline",
			},
			size: {
				sm: "px-md py-xs",
				md: "px-lg py-sm",
			},
		},
		defaultVariants: { variant: "filled", size: "md" },
	}
)

const labelVariants = cva("font-body-semibold leading-tight", {
	variants: {
		variant: {
			filled: "text-on-primary",
			tonal: "text-on-secondary-container",
			outlined: "text-primary",
		},
		size: {
			sm: "text-label",
			md: "text-line",
		},
	},
	defaultVariants: { variant: "filled", size: "md" },
})

export function Button({ className, variant, size, disabled, ...props }) {
	return (
		<TextClassContext value={labelVariants({ variant, size })}>
			<Pressable
				role="button"
				disabled={disabled}
				className={cn(buttonVariants({ variant, size }), disabled && "opacity-50", className)}
				{...props}
			/>
		</TextClassContext>
	)
}
