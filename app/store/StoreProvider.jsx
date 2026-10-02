import { Suspense, use, useEffect } from "react"
import { Provider } from "tinybase/ui-react"
import { attachDownloads } from "../downloads/phone"
import { attachPlayer } from "../player/controller"
import { openStores } from "./instance"
import { LOCAL } from "./local"

// Hands the two stores to every hook once they have loaded from disk; the
// tree waits (in Suspense) until then. The bridges (store ↔ player, store ↔
// downloads) attach once, outside React — they must outlive the tree.
export function StoreProvider({ children }) {
	return (
		<Suspense fallback={null}>
			<Stores>{children}</Stores>
		</Suspense>
	)
}

function Stores({ children }) {
	// openStores() caches its promise, so every render reads the same one.
	const stores = use(openStores())
	useEffect(() => {
		attachPlayer(stores)
		attachDownloads(stores)
	}, [stores])
	return (
		<Provider store={stores.store} storesById={{ [LOCAL]: stores.local }}>
			{children}
		</Provider>
	)
}
