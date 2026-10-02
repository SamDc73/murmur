import { hours, remainingSeconds } from "@murmur/core"
import { View } from "react-native"
import { useIsPlaying } from "react-native-track-player"
import { AddBar } from "../../components/AddBar"
import { EmptyState } from "../../components/EmptyState"
import { QueueList } from "../../components/QueueList"
import { ScreenHeader } from "../../components/ScreenHeader"
import { ServerNotice } from "../../components/ServerNotice"
import { PlayPauseButton } from "../../components/ui/PlayPauseButton"
import { play, toggle } from "../../player/controller"
import { sourceFor } from "../../player/source"
import { useCopiesByItem, useCurrentId, useDeviceId, useLocal, useQueue } from "../../store/hooks"
import { LOCAL_KEYS } from "../../store/local"

// The queue: what is left to hear, in the order it will play, and how long
// that is. One button plays it.
export default function QueueScreen() {
	const queue = useQueue()
	const currentId = useCurrentId()
	const online = useLocal(LOCAL_KEYS.syncState) === "online"

	const left = remainingSeconds(queue, currentId)
	const count = `${queue.length} ${queue.length === 1 ? "episode" : "episodes"}`
	let lede = "Nothing queued"
	if (queue.length > 0 && left > 0) lede = `${count} · ${hours(left)} left`
	else if (queue.length > 0) lede = online ? `${count} · fetching details` : `${count} · server offline`

	return (
		<View className="flex-1 bg-background">
			<ScreenHeader title="Queue" lede={lede}>
				{queue.length > 0 ? <QueuePlayButton queue={queue} currentId={currentId} /> : null}
			</ScreenHeader>
			<ServerNotice hasItems={queue.length > 0} />
			<AddBar />
			<QueueList
				queue={queue}
				empty={
					<EmptyState
						title="Your queue is empty"
						body="Paste a YouTube link — or a whole list. It plays top to bottom, then stops."
					/>
				}
			/>
		</View>
	)
}

// The one button: play the queue, or pause it. It alone follows the player
// and the copies, so the screen around it doesn't.
function QueuePlayButton({ queue, currentId }) {
	const { playing } = useIsPlaying()
	const serverUrl = useLocal(LOCAL_KEYS.serverUrl)
	const token = useLocal(LOCAL_KEYS.token)
	const deviceId = useDeviceId()
	const copiesByItem = useCopiesByItem()
	const playable = queue.some(
		([id]) => sourceFor({ copies: copiesByItem[id] ?? {}, deviceId, serverUrl, token }) !== null
	)
	return <PlayPauseButton size="sm" playing={playing} disabled={!playable} onPress={currentId ? toggle : play} />
}
