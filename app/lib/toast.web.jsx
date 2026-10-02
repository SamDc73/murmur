import { Toaster as Sonner } from "sonner"

export { toast } from "sonner"

// Messages, drawn as Material's snackbars: the inverse surface (dark on a light
// screen, light on a dark one) in the app's own type. On the web the tokens
// are CSS variables, so the toast follows the theme by itself.
const SNACKBAR = {
	background: "var(--color-inverse-surface)",
	color: "var(--color-inverse-on-surface)",
	border: "none",
	borderRadius: "var(--radius-md)",
	fontFamily: "var(--font-body-medium)",
}

export function Toaster(props) {
	return <Sonner toastOptions={{ style: SNACKBAR }} {...props} />
}
