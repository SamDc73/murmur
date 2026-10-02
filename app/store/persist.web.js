import { createLocalPersister as createBrowserLocalPersister } from "tinybase/persisters/persister-browser"
import { createIndexedDbPersister } from "tinybase/persisters/persister-indexed-db"

// Web: the synced store in IndexedDB, device settings in localStorage.
export function createMainPersister(store) {
	return createIndexedDbPersister(store, "murmur")
}

export function createLocalPersister(store) {
	return createBrowserLocalPersister(store, "murmur-local")
}
