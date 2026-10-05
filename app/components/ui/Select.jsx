import * as DropdownMenu from "@rn-primitives/dropdown-menu"
import ChevronDown from "lucide-react-native/icons/chevron-down"
import { Pressable } from "react-native"
import { Icon } from "./Icon"
import { MenuContent, MenuRadioItem } from "./Menu"
import { Text } from "./Text"

// One value out of a few, as a compact dropdown: "1× ▾", "Off ▾".
// options: [{ value, label }]. Values may be numbers; the menu speaks strings.
export function Select({ value, options, onChange, label }) {
	const current = options.find((option) => option.value === value) ?? options[0]
	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger asChild>
				<Pressable
					role="button"
					accessibilityLabel={`${label}: ${current.label}`}
					className="flex-row items-center gap-3xs self-start rounded-xs px-xs py-2xs active:bg-surface-container web:hover:bg-surface-container"
				>
					<Text variant="mono" className="text-on-surface">
						{current.label}
					</Text>
					<Icon as={ChevronDown} className="h-icon-sm w-icon-sm text-on-surface-variant" />
				</Pressable>
			</DropdownMenu.Trigger>
			<MenuContent className="min-w-0">
				<DropdownMenu.RadioGroup
					value={String(current.value)}
					onValueChange={(picked) => {
						const option = options.find((o) => String(o.value) === picked)
						if (option) onChange(option.value)
					}}
				>
					{options.map((option) => (
						<MenuRadioItem
							key={String(option.value)}
							value={String(option.value)}
							label={option.label}
							checked={option.value === current.value}
						/>
					))}
				</DropdownMenu.RadioGroup>
			</MenuContent>
		</DropdownMenu.Root>
	)
}
