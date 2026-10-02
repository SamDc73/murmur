import { Toaster as Sonner } from "sonner-native"
import { useTokenColour } from "./use-token-colour"

export { toast } from "sonner-native"

// Messages, drawn as Material's snackbars: the inverse surface (dark on a light
// screen, light on a dark one) in the app's own type.
export function Toaster(props) {
	const surface = useTokenColour("--color-inverse-surface")
	const ink = useTokenColour("--color-inverse-on-surface")
	const face = useTokenColour("--font-body-medium")
	return (
		<Sonner
			toastOptions={{ style: { backgroundColor: surface }, titleStyle: { color: ink, fontFamily: face } }}
			{...props}
		/>
	)
}
