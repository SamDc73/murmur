import { getUniqueId } from "tinybase"
import { uuidv7 } from "uuidv7"

// Time-ordered ids, so a table sorted by id is sorted by creation. Hermes may
// lack WebCrypto before Expo's polyfills load; then TinyBase's id will do.
export function newId() {
	try {
		return uuidv7()
	} catch {
		return getUniqueId(26)
	}
}
