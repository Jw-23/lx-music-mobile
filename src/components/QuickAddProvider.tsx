import { createContext, useCallback, useContext, useRef } from 'react'
import MusicAddModal, { type MusicAddModalType } from './MusicAddModal'

const QuickAddContext = createContext<(music: LX.Music.MusicInfo) => void>(() => {})
export const useQuickAdd = () => useContext(QuickAddContext)

export default ({ children }: { children: React.ReactNode }) => {
  const ref = useRef<MusicAddModalType>(null)
  const show = useCallback((musicInfo: LX.Music.MusicInfo) => {
    ref.current?.show({ musicInfo, listId: '', isMove: false })
  }, [])
  return <QuickAddContext.Provider value={show}>{children}<MusicAddModal ref={ref} /></QuickAddContext.Provider>
}
