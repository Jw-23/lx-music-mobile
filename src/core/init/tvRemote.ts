import { NativeEventEmitter, NativeModules, Platform, type NativeModule } from 'react-native'
import { play, pause, togglePlay, playNext, playPrev } from '@/core/player/player'
import playerState from '@/store/player/state'
import { createTVRemoteHandler } from '@/core/player/tvRemoteActions'
import { log } from '@/utils/log'

let initialized = false
export default () => {
  if (initialized || Platform.OS !== 'android' || !NativeModules.UtilsModule) return
  initialized = true
  const handle = createTVRemoteHandler({
    current: () => ({ id: playerState.musicInfo.id, position: playerState.progress.nowPlayTime, duration: playerState.progress.maxPlayTime }),
    play,
    pause,
    toggle: togglePlay,
    next: playNext,
    previous: playPrev,
    seek: time => { global.app_event.setProgress(time) },
  })
  // One application-wide listener, shared by home, player and modal windows.
  const emitter = new NativeEventEmitter(NativeModules.UtilsModule as NativeModule)
  emitter.addListener('tv-remote-action', (event: { action?: unknown }) => {
    void handle(event.action).catch((error: unknown) => { log.warn(error instanceof Error ? error.message : String(error)) })
  })
}
