import { COPY_STATE, DEVICE_SERVER, MEDIA_KIND } from "@murmur/core"
import CircleCheck from "lucide-react-native/icons/circle-check"
import CircleMinus from "lucide-react-native/icons/circle-minus"
import Download from "lucide-react-native/icons/download"
import ExternalLink from "lucide-react-native/icons/external-link"
import ListStart from "lucide-react-native/icons/list-start"
import Music2 from "lucide-react-native/icons/music-2"
import Play from "lucide-react-native/icons/play"
import RefreshCw from "lucide-react-native/icons/refresh-cw"
import Trash from "lucide-react-native/icons/trash"
import Video from "lucide-react-native/icons/video"
import { Linking } from "react-native"
import { CAN_DOWNLOAD } from "../downloads/phone"
import { useActions, useCopies, useDeviceId, useItem, useLocal } from "../store/hooks"
import { LOCAL_KEYS } from "../store/local"
import { Menu, MenuItem, MenuSeparator } from "./ui/Menu"

// What you can do to one episode, as a short menu. Only actions that apply
// right now are listed — no headings, no repeated title or artwork. The
// actions read the store only while the menu is open (the menu mounts its
// content then), so a closed ⋮ on every row costs nothing.
//   where: "queue" | "history" | "now"
export function ItemMenu({ itemId, where, trigger, triggerRef, playsNext = false }) {
	return (
		<Menu trigger={trigger} triggerRef={triggerRef}>
			<ItemActions itemId={itemId} where={where} playsNext={playsNext} />
		</Menu>
	)
}

function ItemActions({ itemId, where, playsNext }) {
	const item = useItem(itemId)
	const copies = useCopies(itemId)
	const deviceId = useDeviceId()
	const online = Boolean(useLocal(LOCAL_KEYS.serverUrl))
	const actions = useActions()
	const server = copies[DEVICE_SERVER]
	const mine = copies[deviceId]
	const wantsVideo = (item.wantKind || server?.kind) === MEDIA_KIND.video
	const canDownload = CAN_DOWNLOAD && server?.state === COPY_STATE.ready && where !== "history"
	const canSwapKind = online && item.resolvedAt && where !== "history"

	return (
		<>
			{item.error ? <MenuItem icon={RefreshCw} label="Try again" onPress={() => actions.retry(itemId)} /> : null}
			{where === "history" ? (
				<>
					<MenuItem icon={Play} label="Play now" onPress={() => actions.playAgain(itemId)} />
					<MenuItem icon={ListStart} label="Play next" onPress={() => actions.requeue(itemId, { where: "next" })} />
				</>
			) : null}
			{where === "queue" && !playsNext ? (
				<MenuItem icon={ListStart} label="Play next" onPress={() => actions.playNext(itemId)} />
			) : null}
			{where !== "history" ? (
				<MenuItem icon={CircleCheck} label="Mark as played" onPress={() => actions.markDone(itemId)} />
			) : null}
			{canDownload && mine?.state === COPY_STATE.ready ? (
				<MenuItem icon={CircleMinus} label="Remove download" onPress={() => actions.removeHere(itemId)} />
			) : null}
			{canDownload && mine?.state !== COPY_STATE.ready ? (
				<MenuItem
					icon={Download}
					label="Download"
					disabled={mine?.state === COPY_STATE.downloading}
					onPress={() => actions.downloadHere(itemId)}
				/>
			) : null}
			{canSwapKind ? (
				<MenuItem
					icon={wantsVideo ? Music2 : Video}
					label={wantsVideo ? "Audio only" : "Get the video"}
					onPress={() => actions.wantKind(itemId, wantsVideo ? MEDIA_KIND.audio : MEDIA_KIND.video)}
				/>
			) : null}
			<MenuItem icon={ExternalLink} label="Open on YouTube" onPress={() => Linking.openURL(item.url)} />
			<MenuSeparator />
			<MenuItem
				icon={Trash}
				label={where === "history" ? "Remove from history" : "Remove"}
				destructive
				onPress={() => actions.remove(itemId)}
			/>
		</>
	)
}
