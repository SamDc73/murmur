// Custom entry. Two things must exist before the router loads, because Android
// starts this bundle headless for them — with no screen and no React tree:
//   1. the track player's playback service (lock screen, headset, notification
//      buttons arrive here even when the app is closed);
//   2. the background download task (WorkManager wakes it every so often).
import TrackPlayer from "react-native-track-player"
import "./downloads/task"
import { playbackService } from "./player/service"

TrackPlayer.registerPlaybackService(() => playbackService)

import "expo-router/entry"
