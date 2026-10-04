import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { getListDetail, getListDetailAll } from '@/core/leaderboard'
import { LIST_IDS } from '@/config/constant'
import listState from '@/store/list/state'
import collectSourceList from '@/core/collectSourceList'
import { toMD5 } from '@/utils/tools'


const getListId = (id: string) => `board__${id}`

export const handlePlay = async(id: string, list?: LX.Music.MusicInfoOnline[], index = 0) => {
  let isPlayingList = false
  // console.log(list)
  const listId = getListId(id)
  if (!list?.length) list = (await getListDetail(id, 1)).list
  if (list?.length) {
    await setTempList(listId, [...list])
    void playList(LIST_IDS.TEMP, index)
    isPlayingList = true
  }
  const fullList = await getListDetailAll(id)
  if (!fullList.length) return
  if (isPlayingList) {
    if (listState.tempListMeta.id == listId) {
      await setTempList(listId, [...fullList])
    }
  } else {
    await setTempList(listId, [...fullList])
    void playList(LIST_IDS.TEMP, index)
  }
}

export const handleCollect = async(id: string, name: string, source: LX.OnlineSource) => collectSourceList({
  id: `${source}_${toMD5(getListId(id))}`,
  source,
  sourceListId: getListId(id),
  name,
  load: async() => getListDetailAll(id),
})
