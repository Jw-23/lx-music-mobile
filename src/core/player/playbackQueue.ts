type Music = LX.Music.MusicInfo | LX.Download.ListItem

// A session snapshot: edits must never write back to a saved playlist.
let queue: { listId: string, songs: Music[] } | null = null
const listeners = new Set<() => void>()
const notify = () => { for (const listener of listeners) listener() }

export const subscribePlaybackQueue = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const getPlaybackQueue = (listId: string | null, songs: Music[]): Music[] => queue?.listId === listId ? queue.songs : songs

export const resetPlaybackQueue = () => {
  queue = null
  notify()
}

export const moveQueueSong = (listId: string, songs: Music[], from: number, to: number) => {
  const next = [...getPlaybackQueue(listId, songs)]
  if (from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return
  next.splice(to, 0, next.splice(from, 1)[0])
  queue = { listId, songs: next }
  notify()
}

export const removeQueueSong = (listId: string, songs: Music[], id: string, playingId?: string) => {
  if (id === playingId) return
  queue = { listId, songs: getPlaybackQueue(listId, songs).filter(song => song.id !== id) }
  notify()
}
