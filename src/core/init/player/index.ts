import initPlayer from './player'
import initPlayInfo from './playInfo'
import initPlayStatus from './playStatus'
import initPlayerEvent from './playerEvent'
import initWatchList from './watchList'
import initPlayProgress from './playProgress'
import initPreloadNextMusic from './preloadNextMusic'
import initLyric from './lyric'
import { initRecentHistory } from '@/core/player/recentHistory'

export default async(setting: LX.AppSetting) => {
  await initPlayer(setting)
  await initLyric(setting)
  await initRecentHistory()
  await initPlayInfo(setting)
  initPlayStatus()
  initPlayerEvent()
  initWatchList()
  initPlayProgress()
  initPreloadNextMusic()
}
