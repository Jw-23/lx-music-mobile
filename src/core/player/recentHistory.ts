import { useSyncExternalStore } from 'react'
import { getData, saveData } from '@/plugins/storage'
import playerState from '@/store/player/state'
import { storageDataPrefix } from '@/config/constant'
import { addRecentEntry, parseRecentEntries, type RecentEntry } from './recentHistoryModel'

let entries: RecentEntry[] = []
const listeners = new Set<() => void>()
let loaded: Promise<void> | undefined
let writes = Promise.resolve()
const emit = () => { for (const listener of listeners) listener() }

export const loadRecentHistory = async() => {
  loaded ??= getData<unknown>(storageDataPrefix.recentHistory).then(data => {
    entries = parseRecentEntries(data)
    emit()
  }).catch((error: unknown) => {
    loaded = undefined
    throw error
  })
  await loaded
}

const persist = async(snapshot: RecentEntry[]) => {
  // Serialize writes so a slow save can never resurrect cleared history.
  const next = writes.catch(() => {}).then(async() => saveData(storageDataPrefix.recentHistory, snapshot))
  writes = next
  return next
}

export const recordRecentMusic = async(music: LX.Music.MusicInfo) => {
  await loadRecentHistory()
  const musicInfo = { ...music }
  musicInfo.meta = { ...music.meta }
  entries = addRecentEntry(entries, musicInfo, Date.now())
  emit()
  await persist(entries)
}

export const clearRecentHistory = async() => {
  await loadRecentHistory()
  const previous = entries
  const cleared: RecentEntry[] = []
  entries = cleared
  emit()
  try { await persist(cleared) } catch (error) {
    if (entries === cleared) { entries = previous; emit() }
    throw error
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
const getSnapshot = () => entries
export const useRecentHistory = () => useSyncExternalStore(subscribe, getSnapshot)

export const initRecentHistory = async() => {
  await loadRecentHistory().catch((error: unknown) => { console.warn('Unable to load recent history', error) })
  let recorded = false
  global.app_event.on('musicToggled', () => { recorded = false })
  global.app_event.on('playerPlaying', () => {
    const music = playerState.playMusicInfo.musicInfo
    if (!music || recorded) return
    recorded = true
    const info = 'progress' in music ? music.metadata.musicInfo : music
    void recordRecentMusic(info).catch((error: unknown) => { console.warn('Unable to save recent history', error) })
  })
}
