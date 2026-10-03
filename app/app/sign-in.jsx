import { startTransition, useActionState, useState } from "react"
import { View } from "react-native"
import { MurmurGlyph } from "../components/icons/MurmurGlyph"
import { Button } from "../components/ui/Button"
import { Icon } from "../components/ui/Icon"
import { Input } from "../components/ui/Input"
import { Text } from "../components/ui/Text"
import { useTokenColour } from "../lib/use-token-colour"
import { useActions, useLocal } from "../store/hooks"
import { LOCAL_KEYS } from "../store/local"
import { knock } from "../store/sync"

const WRONG = "Wrong password"

// The web app's front door when its server has a password (MURMUR_PASSWORD):
// one field, checked with the server before it's kept, then remembered by this
// browser. Phones never see it; the pairing code carries the password.
export default function SignInScreen() {
	const serverUrl = useLocal(LOCAL_KEYS.serverUrl)
	const kept = useLocal(LOCAL_KEYS.token)
	const { pair } = useActions()
	const verdigris = useTokenColour("--color-tertiary")
	const [password, setPassword] = useState("")
	const [error, signIn, checking] = useActionState(
		async (_previous, attempt) => {
			const answer = await knock(serverUrl, attempt)
			if (answer !== "ok") return answer === "unauthorised" ? WRONG : "Can’t reach the server. Try again in a moment."
			pair({ serverUrl, token: attempt })
			return ""
		},
		// This browser kept a password and was turned away: it has changed.
		kept ? WRONG : ""
	)

	function submit() {
		const attempt = password.trim()
		if (attempt) startTransition(() => signIn(attempt))
	}

	return (
		<View className="flex-1 items-center justify-center bg-background px-md">
			<View className="w-full max-w-copy items-center gap-md">
				<Icon as={MurmurGlyph} accent={verdigris} className="h-mark w-mark text-primary" />
				<Text variant="heading">Murmur</Text>
				<View className="w-full gap-xs">
					<Input
						value={password}
						onChangeText={setPassword}
						onSubmitEditing={submit}
						placeholder="Password"
						accessibilityLabel="Password"
						autoComplete="current-password"
						secureTextEntry
						autoFocus
					/>
					{error ? (
						<Text variant="label" className="text-error">
							{error}
						</Text>
					) : null}
				</View>
				<Button onPress={submit} disabled={checking || !password.trim()} className="w-full">
					<Text>Sign in</Text>
				</Button>
			</View>
		</View>
	)
}
