export interface RecentEntry {
  musicInfo: LX.Music.MusicInfo
  playedAt: number
}

export const RECENT_LIMIT = 200

export const addRecentEntry = (entries: RecentEntry[], musicInfo: LX.Music.MusicInfo, playedAt: number): RecentEntry[] => [
  { musicInfo, playedAt },
  ...entries.filter(entry => entry.musicInfo.id !== musicInfo.id),
].slice(0, RECENT_LIMIT)

export const parseRecentEntries = (data: unknown): RecentEntry[] => {
  if (!Array.isArray(data)) return []
  const ids = new Set<string>()
  return data.filter((entry: RecentEntry) => {
    const music = entry?.musicInfo
    if (!music || typeof music.id !== 'string' || typeof music.name !== 'string' || typeof music.singer !== 'string' || !music.meta || !['local', 'kw', 'kg', 'tx', 'wy', 'mg'].includes(music.source) || !Number.isFinite(entry.playedAt) || ids.has(music.id)) return false
    ids.add(music.id)
    return true
  }).slice(0, RECENT_LIMIT)
}
