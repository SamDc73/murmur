import * as AlertDialog from "@rn-primitives/alert-dialog"
import { Platform, StyleSheet, View } from "react-native"
import { Button } from "./Button"
import { Text } from "./Text"

// A question with a few answers, centred over a dimmed screen. The last
// action is the suggested one (filled); the rest are quiet; Cancel is always
// there. Used where a tap could surprise: adding something that is already
// here. `open` is controlled; `actions` is [{ label, onPress }].
export function ConfirmDialog({ open, onOpenChange, title, body, actions }) {
	return (
		<AlertDialog.Root open={open} onOpenChange={onOpenChange}>
			<AlertDialog.Portal>
				<AlertDialog.Overlay
					style={OVERLAY}
					className="absolute inset-0 z-50 items-center justify-center bg-veil p-lg web:fixed"
				>
					{/* Its corner is its padding ÷ φ (lg → md); the pills inside are round anyway. */}
					<AlertDialog.Content className="w-full max-w-dialog gap-lg rounded-md bg-surface-container-high p-lg shadow-panel">
						<View className="gap-xs">
							<AlertDialog.Title asChild>
								<Text variant="subheading">{title}</Text>
							</AlertDialog.Title>
							{body ? (
								<AlertDialog.Description asChild>
									<Text variant="line" className="text-on-surface-variant">
										{body}
									</Text>
								</AlertDialog.Description>
							) : null}
						</View>
						<View className="flex-row flex-wrap justify-end gap-xs">
							<AlertDialog.Cancel asChild>
								<Button variant="outlined">
									<Text>Cancel</Text>
								</Button>
							</AlertDialog.Cancel>
							{actions.map((action, index) => (
								<AlertDialog.Action key={action.label} asChild onPress={action.onPress}>
									<Button variant={index === actions.length - 1 ? "filled" : "tonal"}>
										<Text>{action.label}</Text>
									</Button>
								</AlertDialog.Action>
							))}
						</View>
					</AlertDialog.Content>
				</AlertDialog.Overlay>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	)
}

const OVERLAY = Platform.select({ web: undefined, default: StyleSheet.absoluteFill })
