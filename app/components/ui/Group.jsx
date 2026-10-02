import { Children } from "react"
import { Pressable, View } from "react-native"
import { cn } from "./cn"
import { Icon } from "./Icon"
import { Input } from "./Input"
import { Text } from "./Text"

// The settings grammar, as Android and iOS draw it: a small heading, a
// rounded group of rows with hairlines between them, an optional footnote.
// A row is a label on the left and its value or control on the right.

export function Group({ title, footer, children }) {
	const rows = Children.toArray(children)
	return (
		<View className="gap-xs">
			{title ? (
				<Text variant="eyebrow" className="px-sm">
					{title}
				</Text>
			) : null}
			<View className="overflow-hidden rounded-xl bg-surface-container-low">
				{rows.map((row, index) => (
					<View key={row.key} className={index > 0 ? "border-t border-outline-variant" : undefined}>
						{row}
					</View>
				))}
			</View>
			{footer ? (
				<Text variant="caption" className="px-sm text-on-surface-variant">
					{footer}
				</Text>
			) : null}
		</View>
	)
}

export function Row({ label, value, icon, onPress, children }) {
	const Box = onPress ? Pressable : View
	return (
		<Box
			onPress={onPress}
			role={onPress ? "button" : undefined}
			className={cn(
				"min-h-tap-lg flex-row items-center gap-md px-md py-xs",
				onPress && "active:bg-surface-container web:hover:bg-surface-container"
			)}
		>
			<Text variant="line" className="flex-1">
				{label}
			</Text>
			{children}
			{value ? (
				<Text variant="data" numberOfLines={1} className="flex-shrink text-right">
					{value}
				</Text>
			) : null}
			{icon ? <Icon as={icon} className="h-icon w-icon text-on-surface-variant" /> : null}
		</Box>
	)
}

/** A text field that sits inside a row, right-aligned, no box of its own. */
export function RowField(props) {
	return (
		<Input
			autoCapitalize="none"
			autoCorrect={false}
			// Right-aligned by TextInput's own prop on a phone (see Input), by a
			// class on the web, which ignores the prop.
			textAlign="right"
			className="flex-[2] border-0 bg-transparent px-0 web:text-right web:outline-none"
			{...props}
		/>
	)
}
