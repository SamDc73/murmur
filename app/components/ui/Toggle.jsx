import { Switch } from "react-native"
import { useTokenColour } from "../../lib/use-token-colour"

// React Native's switch, coloured from tokens. A Switch takes only values, so
// this is one of the few places a colour passes through JavaScript.
export function Toggle({ value, onChange, label }) {
	const primary = useTokenColour("--color-primary")
	const track = useTokenColour("--color-outline-variant")
	const thumbOn = useTokenColour("--color-on-primary")
	const thumbOff = useTokenColour("--color-surface-container-highest")
	return (
		<Switch
			value={Boolean(value)}
			onValueChange={onChange}
			accessibilityLabel={label}
			trackColor={{ false: track, true: primary }}
			thumbColor={value ? thumbOn : thumbOff}
			ios_backgroundColor={track}
			// react-native-web takes the "on" colours as their own props, and is teal without them.
			activeThumbColor={thumbOn}
			activeTrackColor={primary}
		/>
	)
}
