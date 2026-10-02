// The logo, "Last Bounce": an m drawn as a bouncing ball's path — one tall
// bounce, a smaller one — and the ball come to rest. A queue that plays on,
// then stops. On a 1024 canvas, sized for the full app icon: it stays inside
// the centre 66%, so a circle mask never clips it.
//
// Every rendering of the logo draws from these numbers — the app icon, the
// Android layers, the splash, the favicon (app/scripts/brand.mjs) and the
// glyph inside the app — so they can't drift apart.
export const MARK = {
	path: "M241 628 A117.5 305 0 0 1 476 628 A73 124 0 0 1 622 628",
	stroke: 82,
	ball: { cx: 768, cy: 611, r: 59 },
	// A square around the mark with a little air, for drawing it on its own.
	viewBox: "168 131 690 690",
}

// The same idea redrawn for 16 px: on a tile, thicker strokes, a bigger ball.
export const FAVICON = {
	path: "M138 838 A165 640 0 0 1 467 838 A86 282 0 0 1 640 838",
	stroke: 147,
	ball: { cx: 861, cy: 813, r: 99 },
	tileRadius: 160,
}
