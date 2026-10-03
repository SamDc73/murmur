import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { rmSync } from "node:fs"
import {
	COPY_STATE,
	copyId,
	DEVICE_SERVER,
	historyOf,
	parsePairLink,
	queueOf,
	setting,
	TABLES,
	VALUES,
} from "@murmur/core"
import { chromium } from "playwright"
import { buildWeb, connectPeer, SNOWBOARD, serveWeb, startServer, TEST_8K, waitFor, ZOO } from "./harness.js"

// The web app, end to end, driven like a person would: typing, pasting,
// tapping, holding, dragging, listening. A peer on the same store watches
// from the side, so every tap is checked where it lands — in the shared
// store — and not only on screen. The tests are one story, in order.
//
// By default the production build is served next to the API, as Caddy does.
// For the development setup, point it at a running Metro and put the server
// where the app looks for it next door:
//   APP_URL=http://localhost:8081 SERVER_PORT=3000 bun run e2e:web

setDefaultTimeout(300_000)

const RICK = "https://youtu.be/dQw4w9WgXcQ"

let server
let web
let dist
let browser
let page
let peer
const problems = []

beforeAll(async () => {
	server = await startServer({ port: Number(process.env.SERVER_PORT ?? 3791) })
	if (process.env.APP_URL) {
		web = { url: process.env.APP_URL, stop: () => undefined }
	} else {
		dist = await buildWeb()
		web = serveWeb(dist, server, 3792)
	}
	browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] })
	page = await open()
	peer = await connectPeer(server)
})

afterAll(async () => {
	peer?.close()
	await browser?.close()
	web?.stop()
	await server?.cleanup()
	if (dist) rmSync(dist, { recursive: true, force: true })
})

// ---- helpers ------------------------------------------------------------------

/** The visible one of several matches — screens underneath share labels. */
const see = (locator) => locator.filter({ visible: true }).first()

async function open() {
	const context = await browser.newContext({ viewport: { width: 412, height: 915 } })
	const tab = await context.newPage()
	tab.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`))
	tab.on("console", (message) => {
		if (message.type() === "error") problems.push(`console: ${message.text()}`)
		// Dev builds only (APP_URL=Metro): React Native Web's deprecation warnings.
		if (message.type() === "warning" && /deprecated/i.test(message.text())) problems.push(`warning: ${message.text()}`)
	})
	tab.on("response", (response) => {
		if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`)
	})
	return tab
}

async function connect(tab, token = server.token) {
	await tab.goto(`${web.url}/settings`, { waitUntil: "networkidle" })
	const address = tab.getByPlaceholder("https://murmur.example.com")
	if ((await address.count()) > 0 && !(await address.inputValue())) await address.fill(server.url)
	await tab.locator("input[type=password]").fill(token)
	await see(tab.getByText("Save", { exact: true })).click()
}

async function paste(text, tab = page) {
	await tab.getByPlaceholder("Add a YouTube link").fill(text)
	await see(tab.getByLabel("Add", { exact: true })).click()
}

const row = (title) => see(page.locator(`[aria-label="${title}"]`))
/** A queue row's container: its handle, its tap area and its ⋮ are siblings. */
const rowBox = (title) => row(title).locator("..")

/** Open a row's ⋮ menu and pick an action. */
async function fromMenu(title, action) {
	await rowBox(title).getByLabel("More").click()
	await see(page.getByRole("menuitem", { name: action })).click()
	await see(page.getByRole("menuitem", { name: action })).waitFor({ state: "detached", timeout: 5000 })
}

/** Titles in the order they appear on screen, top to bottom. */
async function onScreen(...titles) {
	const placed = []
	for (const title of titles) {
		const box = await row(title).boundingBox()
		if (box) placed.push([title, box.y])
	}
	return placed.toSorted((a, b) => a[1] - b[1]).map(([title]) => title)
}

/** Grab a row by its handle and drop it just past another row — at a hand's pace:
 *  the gesture handler wants a beat after the press and one move per frame.
 *  Rows glide to new places after a reorder; hovering waits for them to settle
 *  (Playwright's "stable" check) before anything is measured. */
async function drag(title, pastTitle) {
	await row(pastTitle).hover()
	await rowBox(title).getByLabel("Drag to reorder").hover()
	const handle = await rowBox(title).getByLabel("Drag to reorder").boundingBox()
	const target = await row(pastTitle).boundingBox()
	const x = handle.x + handle.width / 2
	const from = handle.y + handle.height / 2
	const to = target.y + target.height * 0.85
	await page.mouse.move(x, from)
	await page.mouse.down()
	await page.waitForTimeout(150)
	for (let step = 1; step <= 24; step++) {
		await page.mouse.move(x, from + ((to - from) * step) / 24)
		await page.waitForTimeout(16)
	}
	await page.waitForTimeout(200)
	await page.mouse.up()
}

/** The bar above the tabs. The other tabs stay mounted underneath, header buttons and all. */
const miniPlayer = () => see(page.getByLabel("Now playing"))

const clock = (tab = page) => tab.evaluate(() => window.rntp?.getMediaElement()?.currentTime ?? 0)
const media = (tab = page) =>
	tab.evaluate(() => {
		const element = window.rntp?.getMediaElement()
		return element ? { paused: element.paused, rate: element.playbackRate } : null
	})
/** The <video> the Watch view plays — not the audio player's own element. */
const watching = (tab = page) =>
	tab.evaluate(() => {
		const element = [...document.querySelectorAll("video")].find((v) => v !== window.rntp?.getMediaElement())
		return element ? { time: element.currentTime, paused: element.paused } : null
	})
const idOf = (video) =>
	Object.entries(peer.store.getTable(TABLES.items)).find(([, item]) => item.videoId === video.id)?.[0]
const queueIds = () => queueOf(peer.store.getTable(TABLES.items)).map(([id]) => id)
const current = () => setting(peer.store.getValues(), VALUES.currentItemId)

// ---- the story ------------------------------------------------------------------

describe("connecting", () => {
	test("finds the server by itself and asks only for the token", async () => {
		await page.goto(`${web.url}/`, { waitUntil: "networkidle" })
		await see(page.getByText("The server wants its token")).waitFor()
		await page.goto(`${web.url}/settings`, { waitUntil: "networkidle" })
		if (!process.env.APP_URL) {
			expect(await page.getByPlaceholder("https://murmur.example.com").count()).toBe(0)
		} else if (server.port === 3000) {
			// Under Metro the server is found next door, on its default port.
			await waitFor(
				async () => (await page.getByPlaceholder("https://murmur.example.com").inputValue()).endsWith(":3000"),
				{
					label: "server address found next door",
				}
			)
		}
		await see(page.getByText("Locked · enter MURMUR_TOKEN")).waitFor()
		expect(problems).toEqual([])
	})

	test("a wrong token says so; the right one connects", async () => {
		await connect(page, "not-the-token")
		await see(page.getByText("Wrong token")).waitFor({ timeout: 10_000 })
		problems.length = 0 // the refused request is the point of this test
		await page.locator("input[type=password]").fill(server.token)
		await see(page.getByText("Save", { exact: true })).click()
		await see(page.getByText(/^Connected/)).waitFor({ timeout: 15_000 })
		// Served by its own server, the web app stops asking once it's in.
		if (!process.env.APP_URL) expect(await page.locator("input[type=password]").count()).toBe(0)
	})

	test("Pair a phone shows a QR code carrying this server and the token", async () => {
		await see(page.getByText("Pair a phone")).click()
		const link = await see(page.getByText(/^murmur:\/\/pair/)).textContent()
		const pairing = parsePairLink(link)
		expect(pairing.token).toBe(server.token)
		expect([web.url, server.url, `http://localhost:${server.port}`]).toContain(pairing.serverUrl)
		expect(await page.locator("svg[viewBox] path").count()).toBeGreaterThan(0)
	})
})

describe("adding", () => {
	test("a paste with no link in it says so, and adds nothing", async () => {
		await page.goto(`${web.url}/`, { waitUntil: "networkidle" })
		await paste("have a listen to this one")
		await see(page.getByText("No YouTube or Google Docs link in that")).waitFor()
		expect(queueIds()).toEqual([])
	})

	test("one field takes a whole list; the server fetches every link", async () => {
		await paste(`${ZOO.url}\n${SNOWBOARD.url}`)
		await see(page.getByText("Added 2")).waitFor()
		await waitFor(() => queueIds().length === 2 && queueIds().every((id) => peer.copy(id).state === COPY_STATE.ready), {
			timeout: 120_000,
			label: "both fetched",
		})
		await see(page.getByText(ZOO.title)).waitFor()
		await see(page.getByText(/fetching|waiting for server|%$/)).waitFor({ state: "detached", timeout: 10_000 })
		await see(page.getByText(/^2 episodes · .* left$/)).waitFor()
		expect(await onScreen(SNOWBOARD.title, ZOO.title)).toEqual([ZOO.title, SNOWBOARD.title])
	})

	test("adding one that is already queued asks first: Cancel changes nothing, Play next moves it up", async () => {
		await paste(SNOWBOARD.url)
		await see(page.getByText("Already in your queue")).waitFor()
		await see(page.getByText(`“${SNOWBOARD.title}”`)).waitFor()
		await see(page.getByRole("button", { name: "Cancel" })).click()
		await see(page.getByText("Already in your queue")).waitFor({ state: "detached" })
		expect(queueIds()).toEqual([idOf(ZOO), idOf(SNOWBOARD)])

		await see(page.getByLabel("Add", { exact: true })).click()
		await see(page.getByRole("button", { name: "Play next" })).click()
		await see(page.getByText("Moved to play next")).waitFor()
		await waitFor(() => queueIds()[0] === idOf(SNOWBOARD), { label: "snowboard first" })
		expect(queueIds().length).toBe(2)
	})

	test("dragging a row by its handle moves it", async () => {
		await drag(SNOWBOARD.title, ZOO.title)
		await waitFor(() => queueIds()[0] === idOf(ZOO), { label: "zoo first after the drag" })
		await waitFor(async () => (await onScreen(ZOO.title, SNOWBOARD.title))[0] === ZOO.title, { label: "on screen too" })
	})

	test("with the server gone a new row waits; when it is back it fills in; ⋮ → Remove deletes it", async () => {
		peer.close()
		await server.stop()
		await paste(TEST_8K.url)
		await see(page.getByText("waiting for server")).waitFor({ timeout: 10_000 })
		expect(await page.getByText("fetching…").count()).toBe(0)
		await server.start()
		peer = await connectPeer(server)
		await see(page.getByText("UHDTV TEST 8K VIDEO.mp4")).waitFor({ timeout: 90_000 })
		problems.length = 0 // refused connections while it was down are expected
		const id = idOf(TEST_8K)
		await fromMenu("UHDTV TEST 8K VIDEO.mp4", "Remove")
		await waitFor(() => !peer.store.hasRow(TABLES.items, id), { label: "removed" })
		await waitFor(() => !Object.keys(server.files()).some((name) => name.startsWith(id)), {
			label: "its files deleted",
		})
	})
})

describe("listening", () => {
	test("tapping a row plays it: the mini player appears and time moves", async () => {
		await see(page.getByText(ZOO.title)).click()
		await see(page.getByLabel("Now playing")).waitFor({ timeout: 15_000 })
		await waitFor(async () => (await clock()) > 1.5, { label: "playback clock" })
		expect(current()).toBe(idOf(ZOO))
	})

	test("Now Playing: a chapter jumps, the speed dropdown is real, back skips, pause saves the spot", async () => {
		await see(page.getByLabel("Now playing")).click()
		await see(page.getByRole("tab", { name: "Chapters" })).click()
		await see(page.getByText("The cool thing", { exact: true })).click()
		await waitFor(async () => (await clock()) >= 5, { timeout: 10_000, label: "chapter jump" })

		await see(page.getByLabel(/^Speed:/)).click()
		await see(page.getByRole("menuitemradio", { name: "1.5×" })).click()
		await waitFor(async () => (await media())?.rate === 1.5, { label: "playback rate" })
		await waitFor(() => setting(peer.store.getValues(), VALUES.playbackRate) === 1.5, { label: "rate synced" })

		const before = await clock()
		await see(page.getByLabel("Back 15 seconds")).click()
		await waitFor(async () => (await clock()) < before, { timeout: 5000, label: "skip back" })

		await see(page.getByText("The cool thing", { exact: true })).click()
		await Bun.sleep(1000)
		await see(page.getByLabel("Pause")).click()
		await waitFor(async () => (await media())?.paused, { label: "paused" })
		await waitFor(() => peer.item(idOf(ZOO)).position >= 5, { label: "position saved to the store" })
	})

	test("the transcript marks the spoken line, a tap jumps to it, and scrolling hands over control", async () => {
		await waitFor(() => peer.item(idOf(ZOO)).transcript === "en", {
			timeout: 60_000,
			label: "transcript on the server",
		})
		await see(page.getByRole("tab", { name: "Transcript" })).click()
		const marked = () => page.locator(".bg-primary-wash").filter({ visible: true })
		await waitFor(async () => /the cool thing about these guys/.test((await marked().allTextContents()).join(" ")), {
			label: "the line at 0:05 is marked",
		})
		await see(page.getByText(/and that.s cool/)).click()
		await waitFor(async () => (await clock()) >= 12, { timeout: 5000, label: "seek to the line" })
		await waitFor(async () => /and that.s cool/.test((await marked().allTextContents()).join(" ")), {
			label: "mark moved",
		})

		// On a short screen the list scrolls; scrolling it yourself stops the following.
		await page.setViewportSize({ width: 412, height: 560 })
		await page.waitForTimeout(400)
		const box = await see(page.getByText("really really long trunks")).boundingBox()
		await page.mouse.move(box.x + 20, box.y)
		await page.mouse.wheel(0, 240)
		await see(page.getByText("Follow", { exact: true })).waitFor({ timeout: 5000 })
		await see(page.getByText("Follow", { exact: true })).click()
		await see(page.getByText("Follow", { exact: true })).waitFor({ state: "detached" })
		await page.setViewportSize({ width: 412, height: 915 })
	})

	test("Watch picks up where the audio was; Listen carries on from the picture", async () => {
		await see(page.getByLabel("More")).click()
		await see(page.getByRole("menuitem", { name: "Get the video" })).click()
		const zoo = idOf(ZOO)
		await waitFor(
			() => {
				const copy = peer.store.getRow(TABLES.copies, copyId(zoo, DEVICE_SERVER))
				return copy.kind === "video" && copy.state === COPY_STATE.ready
			},
			{ timeout: 180_000, label: "the video on the server" }
		)
		await see(page.getByLabel("Play")).click()
		await waitFor(async () => (await clock()) > 1, { label: "audio playing" })

		const heard = await clock()
		await see(page.getByRole("switch")).click()
		await waitFor(async () => (await watching())?.paused === false, { timeout: 15_000, label: "the video plays" })
		expect((await media()).paused).toBe(true)
		expect(Math.abs((await watching()).time - heard)).toBeLessThan(3)

		await page.waitForTimeout(2000)
		const seen = (await watching()).time
		await see(page.getByRole("switch")).click()
		await waitFor(async () => (await media())?.paused === false, { timeout: 10_000, label: "audio carries on" })
		expect(Math.abs((await clock()) - seen)).toBeLessThan(3)
		await see(page.getByLabel("Pause")).click()
	})

	test("the queue plays through and stops at the end — both in History, nothing loops", async () => {
		await see(page.getByLabel(/^Speed:/)).click()
		await see(page.getByRole("menuitemradio", { name: "2×" })).click()
		await see(page.getByLabel("Play")).click()
		await waitFor(() => historyOf(peer.store.getTable(TABLES.items)).length === 2 && current() === "", {
			timeout: 60_000,
			label: "both played",
		})
		await Bun.sleep(3000)
		expect(current()).toBe("")
		expect(queueIds()).toEqual([])
		expect((await media())?.paused).toBe(true)
		await see(page.getByText("Nothing playing")).waitFor()
		await page.goto(`${web.url}/history`, { waitUntil: "networkidle" })
		await see(page.getByText(/^2 played/)).waitFor()
	})
})

describe("History", () => {
	test("tapping an episode plays it again", async () => {
		await row(SNOWBOARD.title).click()
		await waitFor(() => current() === idOf(SNOWBOARD) && queueIds()[0] === idOf(SNOWBOARD), {
			label: "snowboard playing",
		})
		await waitFor(async () => (await clock()) > 0.5, { label: "it plays" })
		await miniPlayer().getByLabel("Pause").click()
	})

	test("+ puts an episode back at the end of the queue", async () => {
		await row(ZOO.title).getByLabel("Add to queue").click()
		await waitFor(() => queueIds().join() === [idOf(SNOWBOARD), idOf(ZOO)].join(), { label: "zoo at the end" })
		await see(page.getByText("Nothing played yet")).waitFor()
	})
})

describe("the row menu", () => {
	test("a tap outside closes it and changes nothing; Mark as played moves it to History", async () => {
		await page.goto(`${web.url}/`, { waitUntil: "networkidle" })
		await rowBox(ZOO.title).getByLabel("More").click()
		await see(page.getByRole("menuitem", { name: "Mark as played" })).waitFor()
		await page.mouse.click(200, 40)
		await see(page.getByRole("menuitem", { name: "Mark as played" })).waitFor({ state: "detached", timeout: 5000 })
		expect(queueIds().length).toBe(2)

		await fromMenu(ZOO.title, "Mark as played")
		await waitFor(() => peer.item(idOf(ZOO)).doneAt > 0 && !queueIds().includes(idOf(ZOO)), {
			label: "marked as played",
		})
	})

	test("a paste mixing new, queued and played asks once, and Add all brings the played one back", async () => {
		await paste(`${ZOO.url} ${RICK} ${SNOWBOARD.url}`)
		await see(page.getByText("Some of these are already here")).waitFor()
		await see(page.getByText("1 new · 1 already in your queue · 1 played before")).waitFor()
		await see(page.getByRole("button", { name: "Add all" })).click()
		await see(page.getByText("Added one · 1 back from History")).waitFor()
		await waitFor(() => queueIds().length === 3 && peer.item(idOf(ZOO)).doneAt === 0, { label: "zoo back, rick added" })
		expect(queueIds()[0]).toBe(idOf(SNOWBOARD))
		expect(queueIds().slice(1).sort()).toEqual([idOf(ZOO), idOf({ id: "dQw4w9WgXcQ" })].sort())
	})

	test("removing the episode that is playing moves on to the next", async () => {
		await row(SNOWBOARD.title).click()
		await waitFor(() => current() === idOf(SNOWBOARD), { label: "snowboard current" })
		const snowboard = idOf(SNOWBOARD)
		await fromMenu(SNOWBOARD.title, "Remove")
		await waitFor(() => !peer.store.hasRow(TABLES.items, snowboard) && current() !== snowboard, { label: "moved on" })
		expect(queueIds()).toContain(current())
		const rick = idOf({ id: "dQw4w9WgXcQ" })
		if (rick)
			await fromMenu("Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)", "Remove").catch(() =>
				peer.store.delRow(TABLES.items, rick)
			)
		const pause = miniPlayer().getByLabel("Pause")
		if (await pause.count()) await pause.click()
	})
})

describe("two browsers", () => {
	test("share one queue: what one adds, the other shows", async () => {
		const other = await open()
		await connect(other)
		await see(other.getByText(/^Connected/)).waitFor({ timeout: 15_000 })
		await other.goto(`${web.url}/`, { waitUntil: "networkidle" })
		await see(other.getByText(ZOO.title)).waitFor({ timeout: 30_000 })
		await paste(SNOWBOARD.url)
		await see(other.getByText(SNOWBOARD.title)).waitFor({ timeout: 90_000 })
		await other.context().close()
	})

	test("nothing went wrong along the way: no errors, no failed requests", () => {
		expect(problems).toEqual([])
	})
})
