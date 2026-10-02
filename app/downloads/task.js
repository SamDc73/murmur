import * as BackgroundTask from "expo-background-task"
import * as TaskManager from "expo-task-manager"
import { openStores } from "../store/instance"
import { syncOnce } from "../store/sync"
import { runDownloads } from "./runner"

// Fetching while the app is closed. Android's WorkManager runs this every so
// often (never more than once per 15 minutes, and only when the system feels
// like it — that is the battery contract on Android 16). It syncs briefly so
// it learns what the server finished, downloads within a time budget, and
// syncs once more so the server learns what this phone now holds.
// Defined at module scope of the entry file so a headless start finds it.

const DOWNLOAD_TASK = "murmur-downloads"
const BUDGET_MS = 8 * 60 * 1000

TaskManager.defineTask(DOWNLOAD_TASK, async () => {
	try {
		const stores = await openStores()
		await syncOnce(stores.store, stores.local, 4000)
		await runDownloads(stores, { budgetMs: BUDGET_MS })
		// Tell the server what this phone now holds (it may let its own copies go).
		await syncOnce(stores.store, stores.local, 4000)
		return BackgroundTask.BackgroundTaskResult.Success
	} catch (error) {
		console.warn("[downloads] background task failed", error)
		return BackgroundTask.BackgroundTaskResult.Failed
	}
})

export async function registerDownloadTask() {
	try {
		const status = await BackgroundTask.getStatusAsync()
		if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false
		await BackgroundTask.registerTaskAsync(DOWNLOAD_TASK, { minimumInterval: 30 })
		return true
	} catch (error) {
		console.warn("[downloads] could not register background task", error)
		return false
	}
}
