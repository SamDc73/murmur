const { mkdirSync, copyFileSync, writeFileSync } = require("node:fs")
const { join } = require("node:path")
const { withDangerousMod } = require("expo/config-plugins")

// media3 draws the playback notification's status-bar icon from the drawable
// alias `media3_notification_small_icon` (its own circular play button). An
// app resource of the same name wins, so at prebuild this copies the mark in
// (assets/notification-icon.xml, made by `bun run brand`) and points the
// alias at it. track-player 5 has no option for this.
module.exports = function withMedia3NotificationIcon(config) {
	return withDangerousMod(config, [
		"android",
		(config) => {
			const res = join(config.modRequest.platformProjectRoot, "app/src/main/res")
			mkdirSync(join(res, "drawable"), { recursive: true })
			mkdirSync(join(res, "values"), { recursive: true })
			copyFileSync(
				join(config.modRequest.projectRoot, "assets/notification-icon.xml"),
				join(res, "drawable/murmur_notification.xml")
			)
			writeFileSync(
				join(res, "values/media3_notification.xml"),
				'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n\t<drawable name="media3_notification_small_icon">@drawable/murmur_notification</drawable>\n</resources>\n'
			)
			return config
		},
	])
}
