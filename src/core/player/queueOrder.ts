import { filterMusicList } from './utils'

type Music = LX.Player.PlayMusic
type PlayInfo = LX.Player.PlayMusicInfo
type Method = LX.AppSetting['player.togglePlayMethod']

// Keep one shuffle order for the session so rendering/preloading cannot draw
// a different next song. Played songs are still filtered by the player history.
export const createShuffleOrder = (random: (max: number) => number) => {
  let ids: string[] = []
  return {
    reset() { ids = [] },
    order(songs: Music[]) {
      const missing = songs.map(song => song.id).filter(id => !ids.includes(id))
      for (let index = missing.length - 1; index > 0; index--) {
        const to = Math.max(0, Math.min(index, random(index + 1)))
        ;[missing[index], missing[to]] = [missing[to], missing[index]]
      }
      ids = [...ids.filter(id => songs.some(song => song.id === id)), ...missing]
      return ids
    },
  }
}

/** One cycle of the actual upcoming sequence, shared by the queue and player. */
export const buildPlaybackSequence = ({ listId, songs, current, anchorIndex, playedList, pending, method, manual = false, randomOrder, dislikeInfo }: {
  listId: string | null
  songs: Music[]
  current: { musicInfo: Music | null, isTempPlay: boolean }
  anchorIndex: number
  playedList: PlayInfo[]
  pending: PlayInfo[]
  method: Method
  manual?: boolean
  randomOrder: string[]
  dislikeInfo: Omit<LX.Dislike.DislikeInfo, 'rules'>
}): { songs: PlayInfo[], resetHistory: boolean } => {
  if (!current.musicInfo || !listId) return { songs: [...pending], resetHistory: false }
  const anchor = songs[anchorIndex]
  const historyIndex = playedList.findIndex(info => info.musicInfo.id === (current.isTempPlay ? anchor?.id : current.musicInfo?.id))
  const history = playedList.slice(historyIndex + 1).filter(info => info.listId !== listId || songs.some(song => song.id === info.musicInfo.id))
  const filtered = filterMusicList({ listId, list: songs, playedList, playerMusicInfo: anchor, dislikeInfo, isNext: true })
  const resetHistory = !filtered.filteredList.length && !!playedList.length
  const eligible = resetHistory ? filtered.canPlayList : filtered.filteredList
  let index = filtered.playerIndex
  if (index === -1 && eligible.length && !(current.isTempPlay && anchorIndex < 0)) index = 0
  if (manual && (method === 'list' || method === 'singleLoop' || method === 'none')) method = 'listLoop'
  let ordered: Music[] = []
  switch (method) {
    case 'listLoop':
      ordered = [...eligible.slice(index + 1), ...eligible.slice(0, index + 1)]
      break
    case 'list':
      ordered = eligible.slice(index + 1)
      break
    case 'random':
      ordered = [...eligible].sort((a, b) => randomOrder.indexOf(a.id) - randomOrder.indexOf(b.id))
      break
    case 'singleLoop':
      if (eligible.length) ordered = [eligible[Math.max(0, index)]]
      break
  }
  const historyIds = new Set(history.filter(info => info.listId === listId).map(info => info.musicInfo.id))
  return {
    songs: [...pending, ...history, ...ordered.filter(song => !historyIds.has(song.id)).map(musicInfo => ({ listId, musicInfo, isTempPlay: false }))],
    resetHistory,
  }
}
