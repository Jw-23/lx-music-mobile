import { clearFailedMusic, setMusicUrl, skipFailedMusic } from '@/core/player/player'
import { urlRefreshGuard } from '@/core/player/urlRefreshGuard'
import { setStatusText } from '@/core/player/playStatus'
import { getPosition, isEmpty, setStop } from '@/plugins/player'
import { isActive } from '@/utils/tools'
import BackgroundTimer from 'react-native-background-timer'
import playerState from '@/store/player/state'
import { setNowPlayTime } from '@/core/player/progress'

export default () => {
  let loadingTimeout: number | null = null
  let delayNextTimeout: number | null = null
  let healthyTimeout: number | null = null

  const clearLoadingTimeout = () => {
    if (loadingTimeout != null) BackgroundTimer.clearTimeout(loadingTimeout)
    loadingTimeout = null
  }
  const clearDelayNextTimeout = () => {
    if (delayNextTimeout != null) BackgroundTimer.clearTimeout(delayNextTimeout)
    delayNextTimeout = null
  }
  const clearHealthyTimeout = () => {
    if (healthyTimeout != null) BackgroundTimer.clearTimeout(healthyTimeout)
    healthyTimeout = null
  }

  const handleError = () => {
    const musicInfo = playerState.playMusicInfo.musicInfo
    if (!musicInfo || global.lx.isPlayedStop || urlRefreshGuard.busy()) return
    clearLoadingTimeout()
    clearHealthyTimeout()

    // Reserve before awaiting the native position: duplicate errors share one retry.
    const token = urlRefreshGuard.reserve()
    if (token != null) {
      void getPosition().catch(() => null).then(async(position) => {
        if (!urlRefreshGuard.isCurrent(token) || playerState.playMusicInfo.musicInfo !== musicInfo || global.lx.isPlayedStop) return
        if (position != null && Number.isFinite(position) && position >= 0) setNowPlayTime(position)
        setStatusText(global.i18n.t('player__refresh_url'))
        await setMusicUrl(musicInfo, true)
      }).catch(console.warn).finally(() => { urlRefreshGuard.finish(token) })
      return
    }

    const failureToken = urlRefreshGuard.fail()
    void (isEmpty() ? Promise.resolve() : setStop()).catch(console.warn).then(() => {
      if (playerState.playMusicInfo.musicInfo !== musicInfo || global.lx.isPlayedStop || !urlRefreshGuard.isCurrent(failureToken)) return
      setStatusText(global.i18n.t('player__error'))
      if (!isActive()) { void skipFailedMusic().catch(console.warn); return }
      clearDelayNextTimeout()
      delayNextTimeout = BackgroundTimer.setTimeout(() => {
        delayNextTimeout = null
        if (playerState.playMusicInfo.musicInfo !== musicInfo || global.lx.isPlayedStop || !urlRefreshGuard.isCurrent(failureToken)) return
        void skipFailedMusic().catch(console.warn)
      }, 5000)
    })
  }

  const handleLoadstart = () => {
    if (global.lx.isPlayedStop || !playerState.isPlay) return
    clearLoadingTimeout()
    clearHealthyTimeout()
    const musicInfo = playerState.playMusicInfo.musicInfo
    loadingTimeout = BackgroundTimer.setTimeout(() => {
      loadingTimeout = null
      if (playerState.playMusicInfo.musicInfo !== musicInfo || global.lx.isPlayedStop) return
      // URL results are only accepted while paused; transition before refreshing.
      global.app_event.error()
      handleError()
    }, 25000)
    setStatusText(global.i18n.t('player__loading'))
  }

  const handlePlaying = () => {
    setStatusText('')
    clearLoadingTimeout()
    clearDelayNextTimeout()
    clearHealthyTimeout()
    const musicInfo = playerState.playMusicInfo.musicInfo
    // Ready/Playing can briefly fire before a bad stream errors. Only sustained
    // playback clears the failure chain and grants a fresh retry budget.
    healthyTimeout = BackgroundTimer.setTimeout(() => {
      healthyTimeout = null
      if (playerState.playMusicInfo.musicInfo !== musicInfo || !playerState.isPlay || urlRefreshGuard.busy()) return
      clearFailedMusic()
      urlRefreshGuard.reset()
    }, 5000)
  }
  const handleEmptied = () => {
    clearDelayNextTimeout()
    clearLoadingTimeout()
    clearHealthyTimeout()
  }
  const handleWaiting = () => {
    clearHealthyTimeout()
    setStatusText(global.i18n.t('player__buffering'))
  }
  const handleSetPlayInfo = () => {
    urlRefreshGuard.reset()
    handleEmptied()
  }

  global.app_event.on('playerLoadstart', handleLoadstart)
  global.app_event.on('playerPlaying', handlePlaying)
  global.app_event.on('playerWaiting', handleWaiting)
  global.app_event.on('playerEmptied', handleEmptied)
  global.app_event.on('playerError', handleError)
  global.app_event.on('musicToggled', handleSetPlayInfo)
  global.app_event.on('pause', clearHealthyTimeout)
  global.app_event.on('stop', handleEmptied)
}
