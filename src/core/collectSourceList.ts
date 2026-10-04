import { createList, removeUserList } from '@/core/list'
import listState from '@/store/list/state'
import syncSourceList from './syncSourceList'
import { confirmDialog, toast } from '@/utils/tools'
import { isSameSourceList, normalizeSourceListId } from './sourceListIdentity'

interface CollectionOptions {
  id: string
  name: string
  source: LX.OnlineSource
  sourceListId: string
  load: () => Promise<LX.Music.MusicInfoOnline[]>
}
const pending = new Map<string, Promise<boolean>>()
const collect = async({ id, name, source, sourceListId, load }: CollectionOptions) => {
  const targetList = listState.userList.find(list => isSameSourceList(list, source, sourceListId))
  if (targetList) {
    const confirmed = await confirmDialog({
      message: global.i18n.t('duplicate_list_tip', { name: targetList.name }),
      cancelButtonText: global.i18n.t('list_import_part_button_cancel'),
      confirmButtonText: global.i18n.t('confirm_button_text'),
    })
    if (!confirmed) return false
    toast(global.i18n.t('library_collecting'))
    await syncSourceList(targetList)
    toast(global.i18n.t('list_update_success', { name: targetList.name }))
    return true
  }
  if (!sourceListId) throw new Error('Missing playlist ID')
  toast(global.i18n.t('library_collecting'))
  const list = await load()
  if (!list.length) throw new Error('No playlist songs received')
  const existed = listState.userList.some(list => list.id === id)
  try {
    await createList({ name: name || global.i18n.t('collect_songlist'), id, list, source, sourceListId: normalizeSourceListId(source, sourceListId) })
  } catch (error) {
    // Creating metadata and saving songs are separate writes. Remove a newly
    // created empty entry if saving songs fails, without touching an existing list.
    if (!existed && listState.userList.some(list => list.id === id)) {
      await removeUserList([id]).catch(console.warn)
    }
    throw error
  }
  toast(global.i18n.t('collect_success'))
  return true
}

export default async(options: CollectionOptions): Promise<boolean> => {
  const key = `${options.source}__${normalizeSourceListId(options.source, options.sourceListId)}`
  const existing = pending.get(key)
  if (existing) return existing
  const operation = collect(options).catch(error => {
    console.warn('Playlist collection failed', error)
    toast(global.i18n.t('library_collect_failed'))
    return false
  }).finally(() => { pending.delete(key) })
  pending.set(key, operation)
  return operation
}
