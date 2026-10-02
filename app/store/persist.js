import { openDatabaseSync } from "expo-sqlite"
import { createExpoSqlitePersister } from "tinybase/persisters/persister-expo-sqlite"

// Android: both stores as JSON blobs in one SQLite file. Opened at module
// scope so the headless playback service and the background task — which have
// no React tree — reach the same database as the screens.
const db = openDatabaseSync("murmur.db")

export function createMainPersister(store) {
	return createExpoSqlitePersister(store, db, { mode: "json", storeTableName: "main" })
}

export function createLocalPersister(store) {
	return createExpoSqlitePersister(store, db, { mode: "json", storeTableName: "local" })
}
