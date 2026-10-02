import { Database } from "bun:sqlite"
import { createMergeableStore } from "tinybase"
import { createSqliteBunPersister } from "tinybase/persisters/persister-sqlite-bun"

// The server's copy of the one store. A MergeableStore so it merges with
// every phone and browser; persisted as JSON into one SQLite table, which is
// the whole database — back up DATA_DIR and you have everything but the media.
export async function openStore(config) {
	const store = createMergeableStore("server")
	const db = new Database(config.dbPath, { create: true })
	db.exec("PRAGMA journal_mode = WAL")
	const persister = createSqliteBunPersister(store, db, { mode: "json", storeTableName: "murmur" })
	await persister.startAutoLoad()
	await persister.startAutoSave()
	return { store, persister, db }
}
