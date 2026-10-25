import { NativeEventEmitter, NativeModules, Platform, type NativeModule } from 'react-native'
import { createLanController, LanCommandError } from '@/core/lan/controller'
import settingState from '@/store/setting/state'
import { state as userApiState } from '@/store/userApi'
import { updateSetting } from '@/core/common'
import { importUserApi } from '@/core/userApi'
import { setApiSource } from '@/core/apiSource'
import musicSdk from '@/utils/musicSdk'
import { httpFetch } from '@/utils/request'
import playerState from '@/store/player/state'
import { playList, playNext, playPrev, togglePlay, play, pause } from '@/core/player/player'
import { addListMusics } from '@/core/list'
import { LIST_IDS } from '@/config/constant'
import { getListMusicSync } from '@/utils/listManage'
import { createTVRemoteHandler } from '@/core/player/tvRemoteActions'
import { log } from '@/utils/log'
import { toNewMusicInfo } from '@/utils'

let initialized = false
const timeout = async<T,>(promise: Promise<T>, milliseconds: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([promise, new Promise<never>((resolve, reject) => { timer = setTimeout(() => { reject(new Error('请求超时，请重试')) }, milliseconds) })]).finally(() => { clearTimeout(timer) })
}
export default async() => {
  const native = NativeModules.LanRemoteModule as NativeModule & {
    complete: (id: string, code: number, body: string) => void
    startIfEnabled: () => Promise<unknown>
  }
  if (initialized || Platform.OS !== 'android' || !native) return
  initialized = true
  const player = createTVRemoteHandler({
    current: () => ({ id: playerState.musicInfo.id, position: playerState.progress.nowPlayTime, duration: playerState.progress.maxPlayTime }),
    play,
    pause,
    toggle: togglePlay,
    next: playNext,
    previous: playPrev,
    seek: time => { global.app_event.setProgress(time) },
  })
  const handle = createLanController({
    settings: () => settingState.setting,
    updateSettings: updateSetting,
    sources: () => userApiState.list.map(({ id, name, version, description }) => ({ id, name, version, description })),
    selectedSource: () => ({ id: settingState.setting['common.apiSource'], ready: userApiState.status.status, message: userApiState.status.message }),
    importScript: importUserApi,
    download: async url => {
      const request = httpFetch(url, { method: 'get', timeout: 15000 })
      const response = await request.promise
      if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(`下载失败：HTTP ${response.statusCode}`)
      if (typeof response.body !== 'string') throw new Error('链接未返回音源脚本')
      return response.body
    },
    useSource: async id => { setApiSource(id); await timeout(global.lx.apiInitPromise[0], 22000) },
    platforms: () => musicSdk.sources.map(({ id, name }: { id: string, name: string }) => ({ id, name })),
    search: async(text, source, page) => {
      const result = await timeout(musicSdk[source as LX.OnlineSource].musicSearch.search(text, page, 30) as Promise<{ list: LX.Music.MusicInfoOnline[], total: number, allPage: number }>, 22000)
      return { list: result.list.map(song => toNewMusicInfo(song) as LX.Music.MusicInfoOnline), total: result.total, maxPage: result.allPage }
    },
    play: async song => {
      await addListMusics(LIST_IDS.DEFAULT, [song as LX.Music.MusicInfoOnline], settingState.setting['list.addMusicLocationType'])
      const index = getListMusicSync(LIST_IDS.DEFAULT).findIndex(music => music.id === song.id)
      if (index < 0) throw new Error('歌曲未能加入播放列表')
      await playList(LIST_IDS.DEFAULT, index)
    },
    player: async action => { if (!await player(action)) throw new Error('当前没有可播放的歌曲') },
    nowPlaying: () => ({ name: playerState.musicInfo.name, singer: playerState.musicInfo.singer, playing: playerState.isPlay, status: playerState.statusText, position: playerState.progress.nowPlayTime, duration: playerState.progress.maxPlayTime }),
    now: Date.now,
  })
  new NativeEventEmitter(native).addListener('lan-request', (event: { id: string, body: string, deadline: number }) => {
    void Promise.resolve().then(async() => handle(JSON.parse(event.body) as unknown, event.deadline)).then(result => {
      native.complete(event.id, 200, JSON.stringify(result))
    }).catch((error: unknown) => {
      const code = error instanceof LanCommandError ? error.status : error instanceof SyntaxError ? 400 : 422
      native.complete(event.id, code, JSON.stringify({ error: error instanceof Error ? error.message : '操作失败，请重试' }))
    })
  })
  try { await native.startIfEnabled() } catch (error: unknown) { log.warn(error instanceof Error ? error.message : String(error)) }
}
