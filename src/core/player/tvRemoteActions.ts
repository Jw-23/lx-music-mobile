export type RemoteAction = 'play' | 'pause' | 'toggle' | 'next' | 'previous' | 'forward' | 'rewind'
export const seekTVPosition = (position: number, duration: number, direction: number) => {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return null
  return Math.max(0, Math.min(duration, position + direction * 10))
}
export const createTVRemoteHandler = (dependencies: {
  current: () => { id: string | null, position: number, duration: number }
  play: () => void
  pause: () => Promise<void>
  toggle: () => void
  next: () => Promise<void>
  previous: () => Promise<void>
  seek: (time: number) => void
}) => async(action: unknown) => {
  const current = dependencies.current()
  if (!current.id) return false
  switch (action) {
    case 'play': dependencies.play(); break
    case 'pause': await dependencies.pause(); break
    case 'toggle': dependencies.toggle(); break
    case 'next': await dependencies.next(); break
    case 'previous': await dependencies.previous(); break
    case 'forward': case 'rewind': {
      const position = seekTVPosition(current.position, current.duration, action === 'forward' ? 1 : -1)
      if (position === null) return false
      dependencies.seek(position)
      break
    }
    default: return false
  }
  return true
}
