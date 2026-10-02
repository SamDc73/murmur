import Svg, { Circle, Path } from "react-native-svg"

// The places' icons. Thin 24-grid line work, round caps, no fills, the same
// props a lucide icon takes — so the `Icon` wrapper colours them from a token
// class and nothing here names a colour. The one exception is the resting
// ball (the logo's verdigris dot): it takes `accent`, and without one it
// draws in the stroke colour. (The mark itself is MurmurGlyph.jsx.)
function glyph(name, draw, strokeWidth = 1.6) {
	function Glyph({ color = "currentColor", size = 24, accent, ...props }) {
		return (
			<Svg
				width={size}
				height={size}
				viewBox="0 0 24 24"
				fill="none"
				stroke={color}
				strokeWidth={props.strokeWidth ?? strokeWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
				{...props}
			>
				{draw(accent ?? color)}
			</Svg>
		)
	}
	Glyph.displayName = name
	return Glyph
}

// A list that comes to rest: two full rows, a shorter one, and the ball.
export const QueueGlyph = glyph(
	"QueueGlyph",
	(ball) => [
		<Path key="rows" d="M4 6.5h16M4 12h16M4 17.5h9" />,
		<Circle key="ball" cx="17.6" cy="17.5" r="2.1" fill={ball} stroke="none" />,
	],
	1.9
)

export const HistoryGlyph = glyph("HistoryGlyph", () => [
	<Path key="ring" d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />,
	<Path key="arrow" d="M3.5 3.5v5h5" />,
	<Path key="hands" d="M12 7.5V12l3 2" />,
])

export const SettingsGlyph = glyph("SettingsGlyph", () => [
	<Circle key="hub" cx="12" cy="12" r="3" />,
	<Path
		key="cog"
		d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
	/>,
])
