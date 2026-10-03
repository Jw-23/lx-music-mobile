import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { toast } from '@/utils/tools'
import { useI18n } from '@/lang'
import { addListMusics, getListMusics, moveListMusics } from '@/core/list'
import settingState from '@/store/setting/state'
import Sheet from '@/components/common/Sheet'
import PlaylistPicker from '@/components/PlaylistPicker'

export interface SelectInfo {
  selectedList: LX.Music.MusicInfo[]
  listId: string
  isMove: boolean
}
export interface MusicMultiAddModalProps { onAdded?: () => void }
export interface MusicMultiAddModalType { show: (info: SelectInfo) => void }

export default forwardRef<MusicMultiAddModalType, MusicMultiAddModalProps>(({ onAdded }, ref) => {
  const t = useI18n()
  const [info, setInfo] = useState<SelectInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  useImperativeHandle(ref, () => ({ show(info) { if (!submitting.current) setInfo({ ...info, selectedList: [...info.selectedList] }) } }))
  const select = async(list: LX.List.MyListInfo) => {
    if (!info?.selectedList.length || submitting.current) return
    submitting.current = true
    setBusy(true)
    try {
      const existing = new Set((await getListMusics(list.id)).map(song => song.id))
      const songs = info.isMove ? info.selectedList : info.selectedList.filter(song => !existing.has(song.id))
      if (!songs.length) { toast(t('list_add_tip_exists')); return }
      if (info.isMove) await moveListMusics(info.listId, list.id, songs, settingState.setting['list.addMusicLocationType'])
      else await addListMusics(list.id, songs, settingState.setting['list.addMusicLocationType'])
      toast(t('library_added', { name: list.name }))
      setInfo(null)
      onAdded?.()
    } catch { toast(t(info.isMove ? 'list_edit_action_tip_move_failed' : 'list_edit_action_tip_add_failed')) } finally { submitting.current = false; setBusy(false) }
  }
  return (
    <Sheet visible={!!info?.selectedList.length} title={t(info?.isMove ? 'library_move' : 'library_add')} onClose={() => { if (!submitting.current) setInfo(null) }}>
      {info ? <PlaylistPicker musics={info.selectedList} sourceListId={info.listId} isMove={info.isMove} busy={busy} onSelect={select} /> : null}
    </Sheet>
  )
})
