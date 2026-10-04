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

// The browser tab's icon: the mark alone, no tile, a quarter heavier so it
// holds at 16 px. The ball moves out by what the thicker stroke and its own
// growth take, keeping the gap; the square is cut close around it all.
export const FAVICON = {
	stroke: MARK.stroke * 1.25,
	ball: { cx: 793, cy: 611, r: MARK.ball.r * 1.25 },
	viewBox: "179 129 698 698",
}
