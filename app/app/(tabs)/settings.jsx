import { AUDIO_FORMATS, bytes, COPY_STATE, normaliseServerUrl, VALUES, VIDEO_HEIGHTS } from "@murmur/core"
import Constants from "expo-constants"
import ChevronDown from "lucide-react-native/icons/chevron-down"
import ChevronUp from "lucide-react-native/icons/chevron-up"
import { useState } from "react"
import { ScrollView, View } from "react-native"
import { PairCode } from "../../components/PairCode"
import { ScanButton } from "../../components/ScanButton"
import { ScreenHeader } from "../../components/ScreenHeader"
import { Button } from "../../components/ui/Button"
import { Group, Row, RowField } from "../../components/ui/Group"
import { Select } from "../../components/ui/Select"
import { Text } from "../../components/ui/Text"
import { Toggle } from "../../components/ui/Toggle"
import { CAN_DOWNLOAD } from "../../downloads/phone"
import { useActions, useCopiesByItem, useDeviceId, useDevices, useLocal, useSetting } from "../../store/hooks"
import { LOCAL_KEYS } from "../../store/local"
import { ORIGIN } from "../../store/origin"
import { useServerInfo } from "../../store/server"

const VIDEO = VIDEO_HEIGHTS.map((value) => ({ value, label: value === 0 ? "Off" : `${value}p` }))
const AUDIO = AUDIO_FORMATS.map((value) => ({ value, label: value }))

export default function SettingsScreen() {
	return (
		<View className="flex-1 bg-background">
			<ScreenHeader title="Settings" />
			<ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
				<View className="mx-auto w-full max-w-form gap-lg px-md pt-xs">
					<ServerGroup />
					<DownloadsGroup />
					{CAN_DOWNLOAD ? <PhoneGroup /> : null}
					<AboutGroup />
				</View>
			</ScrollView>
		</View>
	)
}

function ServerGroup() {
	const serverUrl = useLocal(LOCAL_KEYS.serverUrl)
	const token = useLocal(LOCAL_KEYS.token)
	const syncState = useLocal(LOCAL_KEYS.syncState)
	const error = useLocal(LOCAL_KEYS.lastSyncError)
	const { pair } = useActions()
	// What you're typing, until saved; otherwise what's stored — so a pairing
	// that lands while this screen is open shows at once.
	const [draftUrl, setUrl] = useState(null)
	const [draftPassword, setPassword] = useState(null)
	const url = draftUrl ?? serverUrl
	const password = draftPassword ?? token
	const [pairing, setPairing] = useState(false)
	const info = useServerInfo(syncState === "online")
	const sameOrigin = ORIGIN !== "" && serverUrl === ORIGIN

	function save() {
		pair({ serverUrl: normaliseServerUrl(url), token: password.trim() })
		setUrl(null)
		setPassword(null)
	}

	return (
		<Group title="Server">
			{sameOrigin ? (
				<Row label="Address" value={serverUrl.replace(/^https?:\/\//, "")} />
			) : (
				<Row label="Address">
					<RowField
						value={url}
						onChangeText={setUrl}
						placeholder="https://murmur.example.com"
						inputMode="url"
						onSubmitEditing={save}
					/>
					{normaliseServerUrl(url) !== serverUrl ? <SaveButton onPress={save} /> : <ScanButton />}
				</Row>
			)}
			{/* Asked for only when the server turns this device away. */}
			{syncState === "locked" ? (
				<Row label="Password">
					<RowField
						value={password}
						onChangeText={setPassword}
						placeholder="MURMUR_PASSWORD"
						secureTextEntry
						onSubmitEditing={save}
					/>
					{password.trim() !== token ? <SaveButton onPress={save} /> : null}
				</Row>
			) : null}
			<Row label="Status" value={status(syncState, error, token, info.data)} />
			{!CAN_DOWNLOAD && syncState === "online" ? (
				<Row
					label="Pair a phone"
					icon={pairing ? ChevronUp : ChevronDown}
					onPress={() => setPairing((open) => !open)}
				/>
			) : null}
			{pairing ? <PairCode serverUrl={serverUrl} token={token} /> : null}
		</Group>
	)
}

function status(syncState, error, token, info) {
	if (syncState === "online") return info?.ytdlp ? `Connected · yt-dlp ${info.ytdlp}` : "Connected"
	if (syncState === "connecting") return "Connecting…"
	if (syncState === "locked") return token ? "Wrong password" : "Needs the password"
	if (syncState === "offline") return `Offline${error ? ` · ${error}` : ""}`
	return "No server — links wait for one"
}

function SaveButton({ onPress }) {
	return (
		<Button variant="tonal" size="sm" onPress={onPress}>
			<Text>Save</Text>
		</Button>
	)
}

function DownloadsGroup() {
	const keepOnServer = useSetting(VALUES.keepOnServer)
	const videoHeight = useSetting(VALUES.videoHeight)
	const audioFormat = useSetting(VALUES.audioFormat)
	const devices = useDevices()
	const { setSetting } = useActions()
	// Only phones keep files; browsers stream.
	const phones = [...new Set(Object.values(devices).flatMap((d) => (d.kind === "phone" ? [d.name] : [])))]
	const note =
		phones.length > 0 && !keepOnServer
			? `Once ${phones.join(" or ")} has an episode, the server deletes its copy.`
			: null

	return (
		<Group title="Downloads" footer={note}>
			<Row label="Video">
				<Select
					label="Video"
					value={videoHeight}
					options={VIDEO}
					onChange={(value) => setSetting(VALUES.videoHeight, value)}
				/>
			</Row>
			<Row label="Audio format">
				<Select
					label="Audio format"
					value={audioFormat}
					options={AUDIO}
					onChange={(value) => setSetting(VALUES.audioFormat, value)}
				/>
			</Row>
			{phones.length > 0 ? (
				<Row label="Keep a copy on the server">
					<Toggle
						value={keepOnServer}
						onChange={(value) => setSetting(VALUES.keepOnServer, value)}
						label="Keep a copy on the server"
					/>
				</Row>
			) : null}
		</Group>
	)
}

function PhoneGroup() {
	const autoDownload = useLocal(LOCAL_KEYS.autoDownload)
	const wifiOnly = useLocal(LOCAL_KEYS.wifiOnly)
	const deleteAfterPlay = useLocal(LOCAL_KEYS.deleteAfterPlay)
	const deviceId = useDeviceId()
	const copiesByItem = useCopiesByItem()
	const { setLocal, removeAllHere } = useActions()

	let used = 0
	let count = 0
	for (const copies of Object.values(copiesByItem)) {
		const mine = copies[deviceId]
		if (mine?.state !== COPY_STATE.ready) continue
		used += Number(mine.bytes) || 0
		count++
	}

	return (
		<Group title="This phone">
			<Row label="Download automatically">
				<Toggle
					value={autoDownload}
					onChange={(value) => setLocal(LOCAL_KEYS.autoDownload, value)}
					label="Download automatically"
				/>
			</Row>
			<Row label="Only on Wi‑Fi">
				<Toggle value={wifiOnly} onChange={(value) => setLocal(LOCAL_KEYS.wifiOnly, value)} label="Only on Wi‑Fi" />
			</Row>
			<Row label="Delete after playing">
				<Toggle
					value={deleteAfterPlay}
					onChange={(value) => setLocal(LOCAL_KEYS.deleteAfterPlay, value)}
					label="Delete after playing"
				/>
			</Row>
			<Row label="Stored" value={count === 0 ? "Nothing" : `${count} · ${bytes(used)}`}>
				{count > 0 ? (
					<Button variant="outlined" size="sm" onPress={removeAllHere}>
						<Text>Clear</Text>
					</Button>
				) : null}
			</Row>
		</Group>
	)
}

function AboutGroup() {
	return (
		<Group title="About">
			<Row label="Murmur" value={Constants.expoConfig?.version ?? "dev"} />
		</Group>
	)
}
