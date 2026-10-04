type Music = LX.Music.MusicInfo | LX.Download.ListItem

// A session snapshot: edits must never write back to a saved playlist.
let queue: { listId: string, songs: Music[], ordered?: boolean } | null = null
const listeners = new Set<() => void>()
const notify = () => { for (const listener of listeners) listener() }

export const subscribePlaybackQueue = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const getPlaybackQueue = (listId: string | null, songs: Music[]): Music[] => queue?.listId === listId ? queue.songs : songs

export const isQueueOrdered = (listId: string | null) => queue?.listId === listId && !!queue?.ordered

export const setQueueOrder = (listId: string, songs: Music[]) => {
  queue = { listId, songs: [...songs], ordered: true }
  notify()
}

export const reorderUpcomingSongs = (listId: string, songs: Music[], anchorIndex: number, upcoming: Music[]) => {
  const anchor = songs[anchorIndex]
  const included = new Set(upcoming.map(song => song.id))
  // A stale drag must not reintroduce a deleted song or duplicate the anchor.
  if (included.size !== upcoming.length || upcoming.some(song => song.id === anchor?.id || !songs.some(existing => existing.id === song.id))) return
  const hidden = songs.filter(song => song.id !== anchor?.id && !included.has(song.id))
  setQueueOrder(listId, [...hidden, ...(anchor ? [anchor] : []), ...upcoming])
}

export const resetPlaybackQueue = () => {
  queue = null
  notify()
}

export const moveQueueSong = (listId: string, songs: Music[], from: number, to: number) => {
  const next = [...getPlaybackQueue(listId, songs)]
  if (from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return
  next.splice(to, 0, next.splice(from, 1)[0])
  queue = { listId, songs: next, ordered: true }
  notify()
}

export const removeQueueSong = (listId: string, songs: Music[], id: string, playingId?: string) => {
  if (id === playingId) return
  queue = { listId, songs: getPlaybackQueue(listId, songs).filter(song => song.id !== id), ordered: queue?.ordered }
  notify()
}
