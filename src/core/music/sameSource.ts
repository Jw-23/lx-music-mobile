type Music = LX.Music.MusicInfoOnline
export interface ResolvedMusicUrl {
  url: string
  musicInfo: Music
  quality: LX.Quality
  isFromCache: boolean
}

const normalize = (value: string | null | undefined) => (value ?? '').toLowerCase().replace(/[\s'".,，()（）[\]{}<>！!、·\-_/]+/g, '')
const normalizeSinger = (value: string) => (value ?? '').split(/[、&;；/,，|]/).map(normalize).filter(Boolean).sort().join('|')
const identity = (value: string | number | undefined) => value == null || ['', '0', 'undefined', 'null'].includes(String(value).trim()) ? '' : String(value).trim().toLowerCase()
const duration = (value: string | null) => {
  if (!value || !/^\d+(?::\d{1,2}){1,2}$/.test(value)) return 0
  return value.split(':').reduce((total, part) => total * 60 + Number(part), 0)
}
const hasSameIdentity = (original: Music, candidate: Music) => {
  if (original.id && original.id === candidate.id) return true
  if (identity(original.meta.songId) && identity(original.meta.songId) === identity(candidate.meta.songId)) return true
  if (original.source === 'kg' && candidate.source === 'kg') return !!identity(original.meta.hash) && identity(original.meta.hash) === identity(candidate.meta.hash)
  if (original.source === 'mg' && candidate.source === 'mg') return !!identity(original.meta.copyrightId) && identity(original.meta.copyrightId) === identity(candidate.meta.copyrightId)
  return false
}
const hasSameRecording = (original: Music, candidate: Music) => {
  if (!normalize(original.name) || normalize(original.name) !== normalize(candidate.name)) return false
  if (!normalizeSinger(original.singer) || normalizeSinger(original.singer) !== normalizeSinger(candidate.singer)) return false
  const time = duration(original.interval)
  const candidateTime = duration(candidate.interval)
  const album = normalize(original.meta.albumName)
  const candidateAlbum = normalize(candidate.meta.albumName)
  if (time && candidateTime && Math.abs(time - candidateTime) > 5) return false
  if (album && candidateAlbum && album !== candidateAlbum) return false
  // A changed remote ID needs recording evidence; title alone is ambiguous.
  return !!((time && candidateTime) || (album && candidateAlbum))
}

export const matchSameSourceMusic = (original: Music, candidates: Music[]): Music[] => {
  const sameSource = candidates.filter(candidate => candidate.source === original.source && identity(candidate.meta.songId))
  const exact = sameSource.filter(candidate => hasSameIdentity(original, candidate))
  const recordings = sameSource.filter(candidate => !hasSameIdentity(original, candidate) && hasSameRecording(original, candidate))
  const seen = new Set<string>()
  return [...exact, ...recordings].filter(candidate => {
    const key = `${candidate.id}:${JSON.stringify(candidate.meta)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 2)
}

/** Refresh playlist metadata through the same search path the user can play. */
export const createSameSourceRecovery = ({ search, request, shouldAbort, setTimer, clearTimer, now = Date.now }: {
  search: (musicInfo: Music) => Promise<Music[]>
  request: (musicInfo: Music, quality: LX.Quality | undefined, isRefresh: boolean) => Promise<ResolvedMusicUrl>
  shouldAbort: (error: unknown) => boolean
  setTimer: (callback: () => void, delay: number) => number
  clearTimer: (id: number) => void
  now?: () => number
}) => {
  const pending = new Map<string, Promise<Music[]>>()
  const metadata = new Map<string, { musicInfo: Music, expires: number }>()
  const keyOf = (musicInfo: Music) => `${musicInfo.source}:${musicInfo.id}`
  const load = async(original: Music) => {
    const key = keyOf(original)
    const existing = pending.get(key)
    if (existing) return existing
    const promise = new Promise<Music[]>((resolve, reject) => {
      const timer = setTimer(() => { reject(new Error('song metadata refresh timeout')) }, 12_000)
      Promise.resolve().then(async() => search(original)).then(resolve, reject).finally(() => { clearTimer(timer) }).catch(() => {})
    }).finally(() => { if (pending.get(key) === promise) pending.delete(key) })
    pending.set(key, promise)
    return promise
  }
  return {
    getMetadata(original: Music) {
      const entry = metadata.get(keyOf(original))
      if (entry && entry.expires > now()) return entry.musicInfo
      metadata.delete(keyOf(original))
      return original
    },
    async recover(original: Music, quality: LX.Quality | undefined, isRefresh: boolean): Promise<ResolvedMusicUrl | null> {
      const candidates = matchSameSourceMusic(original, await load(original))
      let lastError: unknown
      for (const candidate of candidates) {
        try {
          const result = await request(candidate, quality, isRefresh)
          if (!result.url?.trim()) throw new Error('empty music URL')
          const key = keyOf(original)
          metadata.delete(key)
          if (metadata.size >= 100) metadata.delete(metadata.keys().next().value!)
          metadata.set(key, { musicInfo: candidate, expires: now() + 15 * 60_000 })
          return result
        } catch (error) {
          if (shouldAbort(error)) throw error
          lastError = error
        }
      }
      if (lastError) throw lastError instanceof Error ? lastError : new Error('same-source music URL unavailable')
      return null
    },
  }
}
