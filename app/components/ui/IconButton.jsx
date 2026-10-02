import { cva } from "class-variance-authority"
import { Pressable } from "react-native"
import { cn } from "./cn"
import { Icon } from "./Icon"

// A round pressable holding one icon: the transport controls, the paste
// button, the "more" dots. Every size is at least a comfortable tap target;
// `play` is the one big one a screen has.
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
			<Icon as={as} className={cn(iconVariants({ variant, size }), iconClassName)} strokeWidth={2.1} />
		</Pressable>
	)
}
