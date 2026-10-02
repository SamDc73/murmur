import { DEVICE_SERVER, TABLES } from "@murmur/core"
import * as Device from "expo-device"
import { Platform } from "react-native"
import { createMergeableStore, createStore } from "tinybase"
import { newId } from "../lib/id"
import { LOCAL_KEYS } from "./local"
import { servedByServer } from "./origin"
import { createLocalPersister, createMainPersister } from "./persist"

// The two stores, once per JavaScript runtime. Screens, the playback service
// and the background download task all call openStores() and get the same
// instances — so a lock-screen button press with the app closed writes to the
// same store the screens will read when they come back.

let opening = null

export function openStores() {
	if (opening === null) opening = open()
	return opening
}

async function open() {
	const local = createStore()
	const localPersister = createLocalPersister(local)
	await localPersister.startAutoLoad()
	await localPersister.startAutoSave()
	ensureDevice(local)
	// A web app served by the server finds it next door — no need to wait on it.
	if (!local.getValue(LOCAL_KEYS.serverUrl)) {
		servedByServer().then((origin) => origin && local.setValue(LOCAL_KEYS.serverUrl, origin))
	}

	const store = createMergeableStore()
	const persister = createMainPersister(store)
	await persister.startAutoLoad()
	await persister.startAutoSave()
	touchDevice(store, local)

	return { store, local }
}

function ensureDevice(local) {
	if (!local.getValue(LOCAL_KEYS.deviceId)) {
		local.setValue(LOCAL_KEYS.deviceId, newId())
	}
	if (!local.getValue(LOCAL_KEYS.deviceName)) {
		local.setValue(LOCAL_KEYS.deviceName, defaultDeviceName())
	}
}

function defaultDeviceName() {
	if (Platform.OS === "web") return "Browser"
	return Device.modelName || Device.deviceName || "Phone"
}

// This device's row in the shared devices table, so other devices can name it.
function touchDevice(store, local) {
	const id = local.getValue(LOCAL_KEYS.deviceId)
	if (!id || id === DEVICE_SERVER) return
	store.setRow(TABLES.devices, id, {
		name: String(local.getValue(LOCAL_KEYS.deviceName) || defaultDeviceName()),
		kind: Platform.OS === "web" ? "web" : "phone",
		lastSeen: Date.now(),
	})
}
