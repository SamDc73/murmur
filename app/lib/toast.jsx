import { Toaster as Sonner } from "sonner-native"
import { useTokenColour } from "./use-token-colour"
import { REM } from "./wide"

export { toast } from "sonner-native"

// Messages, drawn as Material's snackbars: the inverse surface (dark on a light
// screen, light on a dark one) in the app's own type — md in, so its corner
// is sm (padding ÷ φ).
export function Toaster(props) {
	const surface = useTokenColour("--color-inverse-surface")
	const ink = useTokenColour("--color-inverse-on-surface")
	const face = useTokenColour("--font-body-medium")
	return (
		<Sonner
			toastOptions={{
				style: { backgroundColor: surface, padding: REM, borderRadius: 0.618 * REM },
				titleStyle: { color: ink, fontFamily: face, fontSize: 0.942 * REM },
			}}
			{...props}
		/>
	)
}
