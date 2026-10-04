import { setListUpdateTime } from '@/utils/data'
import { overwriteListMusics, setFetchingListStatus } from './list'
import { getListDetailAll } from '@/core/songlist'
import { getListDetailAll as getBoardListAll } from '@/core/leaderboard'
import { normalizeSourceListId } from './sourceListIdentity'

export default async(targetListInfo: LX.List.UserListInfo) => {
  const { id, source, sourceListId } = targetListInfo
  if (!source || !sourceListId) return
  setFetchingListStatus(id, true)
  try {
    const remoteId = normalizeSourceListId(source, sourceListId)
    const list = remoteId.startsWith('board__')
      ? await getBoardListAll(remoteId.slice(7), true)
      : await getListDetailAll(source, remoteId, true)
    if (!list.length) throw new Error('No playlist songs received')
    await overwriteListMusics(id, list)
    await setListUpdateTime(id, Date.now())
  } finally {
    setFetchingListStatus(id, false)
  }
}
