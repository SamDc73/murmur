const path = require("node:path")
const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require("nativewind/metro")

const config = getDefaultConfig(__dirname)
// Resolve @murmur/core from the workspace root.
config.watchFolders = [path.resolve(__dirname, "..")]

// react-native-track-player 5.0.0-alpha0's compiled web build imports a stale
// 4.x copy left in the package; its TypeScript source (the "source" entry of
// its exports) is wired right. On the web only, take that. Drop this once a
// release ships a working build.
const trackPlayerSource = path.join(
	path.dirname(require.resolve("react-native-track-player/package.json")),
	"src/index.tsx"
)
config.resolver.resolveRequest = (context, moduleName, platform) => {
	if (platform === "web" && moduleName === "react-native-track-player") {
		return { type: "sourceFile", filePath: trackPlayerSource }
	}
	return context.resolveRequest(context, moduleName, platform)
}

module.exports = withNativeWind(config, { input: "./global.css" })
