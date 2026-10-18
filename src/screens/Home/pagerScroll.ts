import { createContext, useContext, useLayoutEffect } from 'react'
import { type HomeTabId } from '@/config/homeTabs'

export const HomePagerScrollContext = createContext<(id: HomeTabId, locked: boolean) => void>(() => {})
// Detail pages own their horizontal gesture space; tab taps still work.
export const useHomeScrollLock = (id: HomeTabId, locked: boolean) => {
  const setLocked = useContext(HomePagerScrollContext)
  useLayoutEffect(() => {
    if (!locked) return
    setLocked(id, true)
    return () => { setLocked(id, false) }
  }, [id, locked, setLocked])
}
