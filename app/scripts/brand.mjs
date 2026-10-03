// The logo's files, drawn from one geometry (@murmur/core's brand.js) in the
// colours of tokens.css — so the icon, the splash and the favicon always match
// the app. Rerun after changing either:   bun run brand   (from app/)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { generateAsync as packIco } from "@expo/image-utils/build/Ico.js"
import { FAVICON, MARK } from "@murmur/core/brand"
import { chromium } from "playwright"

const here = (path) => new URL(`../${path}`, import.meta.url)

// Light values come before the dark media block in tokens.css, dark ones after.
const css = readFileSync(here("theme/tokens.css"), "utf8")
const [lightCss, darkCss] = css.split("@media (prefers-color-scheme: dark)")
const token = (block, name) => block.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i"))[1]
const blue = token(lightCss, "primary")
const paper = token(lightCss, "on-primary")
const ball = token(darkCss, "tertiary") // verdigris bright enough for 3:1 on the blue
const light = {
	ink: token(lightCss, "primary"),
	dot: token(lightCss, "tertiary"),
	ground: token(lightCss, "background"),
}
const dark = { ink: token(darkCss, "primary"), dot: token(darkCss, "tertiary"), ground: token(darkCss, "background") }

const canvas = (body, ground = "") =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${ground}${body}</svg>`
const fill = (colour) => `<rect width="1024" height="1024" fill="${colour}"/>`
// Android's adaptive layers are 108 dp of which 72 dp show: the icon's
// composition, scaled by 72/108, lands the mark exactly where the full icon has it.
const mark = (ink, dot, scale = 1) =>
	`<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">` +
	`<path d="${MARK.path}" fill="none" stroke="${ink}" stroke-width="${MARK.stroke}" stroke-linecap="round" stroke-linejoin="round"/>` +
	`<circle cx="${MARK.ball.cx}" cy="${MARK.ball.cy}" r="${MARK.ball.r}" fill="${dot}"/></g>`
const favicon =
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">` +
	`<rect width="1024" height="1024" rx="${FAVICON.tileRadius}" fill="${blue}"/>` +
	`<path d="${FAVICON.path}" fill="none" stroke="${paper}" stroke-width="${FAVICON.stroke}" stroke-linecap="round" stroke-linejoin="round"/>` +
	`<circle cx="${FAVICON.ball.cx}" cy="${FAVICON.ball.cy}" r="${FAVICON.ball.r}" fill="${ball}"/></svg>`

const files = [
	["assets/icon.png", 1024, canvas(mark(paper, ball), fill(blue))],
	["assets/android-icon-foreground.png", 1024, canvas(mark(paper, ball, 72 / 108))],
	["assets/android-icon-monochrome.png", 1024, canvas(mark("#000", "#000", 72 / 108))],
	["assets/splash-icon.png", 1024, canvas(mark(light.ink, light.dot))],
	["assets/splash-icon-dark.png", 1024, canvas(mark(dark.ink, dark.dot))],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } })
const render = async (svg, size) => {
	const sized = svg.replace("<svg ", `<svg width="${size}" height="${size}" `)
	await page.setContent(`<body style="margin:0;background:transparent">${sized}</body>`)
	return page.locator("svg").screenshot({ omitBackground: true })
}
for (const [path, size, svg] of files) {
	writeFileSync(here(path), await render(svg, size))
	console.log(`${path}  ${size}×${size}`)
}
// The tab icon is drawn at each size it's shown at, not shrunk from a big
// one, so 16 px stays crisp. Expo serves public/favicon.ico as it is.
const tabSizes = [16, 32, 48]
const tabIcons = []
for (const size of tabSizes) tabIcons.push(await render(favicon, size))
mkdirSync(here("public"), { recursive: true })
writeFileSync(here("public/favicon.ico"), await packIco(tabIcons))
console.log(`public/favicon.ico  ${tabSizes.join(", ")} px`)
await browser.close()

// The status-bar icon while playing: the mark as a white Android vector, its
// 24 dp box framing it. plugins/media3-notification-icon.js installs it.
const [x, y, side] = MARK.viewBox.split(" ").map(Number)
const { cx, cy, r } = MARK.ball
writeFileSync(
	here("assets/notification-icon.xml"),
	`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="${side}" android:viewportHeight="${side}">
	<group android:translateX="${-x}" android:translateY="${-y}">
		<path android:pathData="${MARK.path}" android:strokeColor="#FFFFFFFF" android:strokeWidth="${MARK.stroke}" android:strokeLineCap="round" android:strokeLineJoin="round" android:fillColor="#00000000"/>
		<path android:pathData="M${cx - r},${cy} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0" android:fillColor="#FFFFFFFF"/>
	</group>
</vector>
`
)
console.log("assets/notification-icon.xml  24 dp vector")

// The native config carries the same colours: the adaptive icon's ground and the splash.
const config = JSON.parse(readFileSync(here("app.json"), "utf8"))
config.expo.android.adaptiveIcon.backgroundColor = blue
for (const plugin of config.expo.plugins) {
	if (Array.isArray(plugin) && plugin[0] === "expo-splash-screen") {
		Object.assign(plugin[1], { image: "./assets/splash-icon.png", backgroundColor: light.ground })
		plugin[1].dark = { image: "./assets/splash-icon-dark.png", backgroundColor: dark.ground }
	}
}
writeFileSync(here("app.json"), `${JSON.stringify(config, null, "\t")}\n`)
console.log(`app.json  adaptive ground ${blue} · splash ${light.ground} / ${dark.ground}`)
