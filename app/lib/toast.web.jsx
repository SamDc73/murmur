import { Toaster as Sonner } from "sonner"

export { toast } from "sonner"

// Messages, drawn as Material's snackbars: the inverse surface (dark on a light
// screen, light on a dark one) in the app's own type — md in, so its corner
// is sm (padding ÷ φ). On the web the tokens are CSS variables, so the toast
// follows the theme by itself.
const SNACKBAR = {
	background: "var(--color-inverse-surface)",
	color: "var(--color-inverse-on-surface)",
	border: "none",
	padding: "var(--spacing-md)",
	borderRadius: "var(--radius-sm)",
	fontFamily: "var(--font-body-medium)",
	fontSize: "var(--text-line)",
}

export function Toaster(props) {
	return <Sonner toastOptions={{ style: SNACKBAR }} {...props} />
}
