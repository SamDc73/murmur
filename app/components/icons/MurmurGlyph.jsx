import { MARK } from "@murmur/core"
import Svg, { Circle, Path } from "react-native-svg"

// The mark: the app icon's own geometry (@murmur/core's brand.js), so the logo
// inside the app is the logo on the home screen.
export function MurmurGlyph({ color = "currentColor", size = 24, accent, ...props }) {
	return (
		<Svg width={size} height={size} viewBox={MARK.viewBox} fill="none" {...props}>
			<Path d={MARK.path} stroke={color} strokeWidth={MARK.stroke} strokeLinecap="round" strokeLinejoin="round" />
			<Circle cx={MARK.ball.cx} cy={MARK.ball.cy} r={MARK.ball.r} fill={accent ?? color} />
		</Svg>
	)
}
