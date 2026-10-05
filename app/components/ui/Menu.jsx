import * as DropdownMenu from "@rn-primitives/dropdown-menu"
import { Platform, StyleSheet } from "react-native"
import { cn } from "./cn"
import { Icon } from "./Icon"
import { Text } from "./Text"

// A dropdown of actions: a trigger, then a short list — icon and label, a
// line between groups, the destructive one last and red. Nothing else: the
// menu never repeats what the row it belongs to already shows. Its corner
// (sm) around its padding (2xs) leaves the items' corners xs — parallel curves.
//   <Menu trigger={<IconButton … />}>
//     <MenuItem icon={ListStart} label="Play next" onPress={…} />
//     <MenuSeparator />
//     <MenuItem icon={Trash} label="Remove" destructive onPress={…} />
//   </Menu>
// `triggerRef` lets something else open it — a long press on the row.

export function Menu({ trigger, triggerRef, children }) {
	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger ref={triggerRef} asChild>
				{trigger}
			</DropdownMenu.Trigger>
			<MenuContent>{children}</MenuContent>
		</DropdownMenu.Root>
	)
}

export function MenuContent({ children, className }) {
	return (
		<DropdownMenu.Portal>
			<DropdownMenu.Overlay style={OVERLAY}>
				<DropdownMenu.Content
					align="end"
					sideOffset={6} // xs
					insets={INSETS}
					className={cn(
						"min-w-4xl overflow-hidden rounded-sm border border-outline-variant bg-surface-container-high p-2xs shadow-panel",
						className
					)}
				>
					{children}
				</DropdownMenu.Content>
			</DropdownMenu.Overlay>
		</DropdownMenu.Portal>
	)
}

export function MenuItem({ icon, label, destructive = false, disabled = false, onPress }) {
	return (
		<DropdownMenu.Item
			disabled={disabled}
			onPress={onPress}
			className={cn(
				"flex-row items-center gap-sm rounded-xs px-sm py-sm active:bg-surface-container-highest web:outline-none web:hover:bg-surface-container-highest web:focus:bg-surface-container-highest",
				disabled && "opacity-40"
			)}
		>
			{icon ? (
				<Icon as={icon} className={cn("h-icon w-icon", destructive ? "text-error" : "text-on-surface-variant")} />
			) : null}
			<Text variant="line" className={destructive ? "text-error" : undefined}>
				{label}
			</Text>
		</DropdownMenu.Item>
	)
}

export function MenuSeparator() {
	return <DropdownMenu.Separator className="mx-2xs my-2xs h-px bg-outline-variant" />
}

// One choice in a dropdown that picks a value (speed, video quality). The
// chosen one is simply in colour — no marker beside it.
export function MenuRadioItem({ value, label, checked = false }) {
	return (
		<DropdownMenu.RadioItem
			value={value}
			className="rounded-xs px-md py-sm active:bg-surface-container-highest web:outline-none web:hover:bg-surface-container-highest web:focus:bg-surface-container-highest"
		>
			<Text variant="line" className={checked ? "font-body-medium text-primary" : undefined}>
				{label}
			</Text>
		</DropdownMenu.RadioItem>
	)
}

// On a phone the overlay catches the tap outside that closes the menu; on
// the web Radix does that itself.
const OVERLAY = Platform.select({ web: undefined, default: StyleSheet.absoluteFill })
// Never closer than md to the screen's edge.
const INSETS = { top: 16, bottom: 16, left: 16, right: 16 }
