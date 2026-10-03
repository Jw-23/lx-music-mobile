import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { toast } from '@/utils/tools'
import { useI18n } from '@/lang'
import { addListMusics, getListMusics, moveListMusics } from '@/core/list'
import settingState from '@/store/setting/state'
import Sheet from '@/components/common/Sheet'
import PlaylistPicker from '@/components/PlaylistPicker'

export interface SelectInfo {
  musicInfo: LX.Music.MusicInfo | null
  listId: string
  isMove: boolean
}
export interface MusicAddModalProps { onAdded?: () => void }
export interface MusicAddModalType { show: (info: SelectInfo) => void }

export default forwardRef<MusicAddModalType, MusicAddModalProps>(({ onAdded }, ref) => {
  const t = useI18n()
  const [info, setInfo] = useState<SelectInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  useImperativeHandle(ref, () => ({ show(info) { if (!submitting.current) setInfo(info) } }))
  const songs = useMemo(() => info?.musicInfo ? [info.musicInfo] : [], [info])
  const select = async(list: LX.List.MyListInfo) => {
    if (!info?.musicInfo || submitting.current) return
    submitting.current = true
    setBusy(true)
    try {
      const existing = await getListMusics(list.id)
      if (existing.some(song => song.id === info.musicInfo?.id)) { toast(t('list_add_tip_exists')); return }
      if (info.isMove) await moveListMusics(info.listId, list.id, [info.musicInfo], settingState.setting['list.addMusicLocationType'])
      else await addListMusics(list.id, [info.musicInfo], settingState.setting['list.addMusicLocationType'])
      toast(t('library_added', { name: list.name }))
      setInfo(null)
      onAdded?.()
    } catch { toast(t(info.isMove ? 'list_edit_action_tip_move_failed' : 'list_edit_action_tip_add_failed')) } finally { submitting.current = false; setBusy(false) }
  }
  return (
    <Sheet visible={!!info?.musicInfo} title={t(info?.isMove ? 'library_move' : 'library_add')} onClose={() => { if (!submitting.current) setInfo(null) }}>
      {info?.musicInfo ? <PlaylistPicker key={info.musicInfo.id} musics={songs} sourceListId={info.listId} isMove={info.isMove} busy={busy} onSelect={select} /> : null}
    </Sheet>
  )
})
