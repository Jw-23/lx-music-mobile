import { useEffect, useRef, useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import Text from '@/components/common/Text'
import { useDesignColors } from '@/theme/design'
import { useI18n } from '@/lang'
import { getList, updatePlayIndex } from '@/core/player/playInfo'
import { clearPlayedList } from '@/core/player/playedList'
import { playQueueSong, resetRandomNextMusicInfo } from '@/core/player/player'
import { moveQueueSong, removeQueueSong, subscribePlaybackQueue } from '@/core/player/playbackQueue'
import playerState from '@/store/player/state'
import playerActions from '@/store/player/action'
import { usePlayInfo, usePlayMusicInfo } from '@/store/player/hook'
import { toast } from '@/utils/tools'

export default () => {
  const dialog = useRef<DialogType>(null)
  const colors = useDesignColors()
  const t = useI18n()
  const current = usePlayMusicInfo()
  const playInfo = usePlayInfo()
  const [, refresh] = useState(0)
  useEffect(() => {
    const update = () => { refresh(value => value + 1) }
    const unsubscribe = subscribePlaybackQueue(update)
    global.state_event.on('playTempPlayListChanged', update)
    global.app_event.on('myListMusicUpdate', update)
    return () => {
      unsubscribe()
      global.state_event.off('playTempPlayListChanged', update)
      global.app_event.off('myListMusicUpdate', update)
    }
  }, [])
  const listId = playInfo.playerListId
  const songs = getList(listId)
  const pending = playerState.tempPlayList
  const rows = [
    ...pending.map((info, index) => ({ info, index, pending: true })),
    ...songs.map((musicInfo, index) => ({ info: { musicInfo, listId, isTempPlay: false }, index, pending: false })),
  ]
  // History and cached random choices must not override an explicit queue edit.
  const edit = (change: () => void) => {
    const anchor = songs[playInfo.playerPlayIndex]?.id
    change()
    clearPlayedList()
    resetRandomNextMusicInfo()
    if (current.isTempPlay && anchor) {
      const next = getList(listId)
      const index = next.findIndex(song => song.id === anchor)
      playerActions.updatePlayIndex(playInfo.playIndex, index >= 0 ? index : Math.min(playInfo.playerPlayIndex - 1, next.length - 1))
    } else updatePlayIndex()
  }
  return <>
    <Pressable onPress={() => { dialog.current?.setVisible(true) }} accessibilityRole="button" accessibilityLabel={t('library_queue')} style={styles.open}>
      <Icon name="list-order" size={22} color={colors.accent} />
    </Pressable>
    <Dialog ref={dialog} title={t('library_queue')} height="80%">
      <Text size={13} color={colors.secondary} style={styles.hint}>{t('library_queue_hint')}</Text>
      {current.isTempPlay && current.musicInfo ? <View style={[styles.hint, { backgroundColor: colors.secondarySurface }]}><Text size={12} color={colors.accent}>{t('library_now_playing')}</Text><Text size={17} numberOfLines={1}>{'progress' in current.musicInfo ? current.musicInfo.metadata.musicInfo.name : current.musicInfo.name}</Text></View> : null}
      <FlatList data={rows} style={{ flex: 1 }} keyExtractor={row => `${row.pending ? 'pending' : 'queue'}_${row.index}_${row.info.musicInfo.id}`} ListEmptyComponent={<Text color={colors.secondary} style={styles.hint}>{t('library_queue_empty')}</Text>} renderItem={({ item: row }) => {
        const music = 'progress' in row.info.musicInfo ? row.info.musicInfo.metadata.musicInfo : row.info.musicInfo
        const active = !row.pending && !current.isTempPlay && current.musicInfo?.id === row.info.musicInfo.id
        const length = row.pending ? pending.length : songs.length
        const move = (to: number) => {
          edit(() => {
            if (row.pending) playerActions.moveTempPlayList(row.index, to)
            else if (listId) moveQueueSong(listId, songs, row.index, to)
          })
        }
        return <View style={[styles.row, { borderBottomColor: colors.separator, backgroundColor: active ? colors.secondarySurface : colors.surface }]}>
          <Pressable style={styles.song} accessibilityRole="button" accessibilityLabel={`${t('library_play')} ${music.name}`} onPress={async() => {
            try {
              if (row.pending) playerActions.removeTempPlayList(row.index)
              await playQueueSong(row.info.musicInfo, row.info.listId, row.pending)
            } catch { toast(t('library_play_failed')) }
          }}>
            <Text size={17} numberOfLines={1} color={active ? colors.accent : colors.text} style={{ fontWeight: active ? '600' : '400' }}>{music.name}</Text>
            <Text size={12} color={colors.secondary} numberOfLines={1}>{t(row.pending ? 'library_queue_priority' : active ? 'library_now_playing' : 'library_queue_order', { count: row.index + 1 })}{music.singer ? ` · ${music.singer}` : ''}</Text>
          </Pressable>
          <Pressable style={styles.action} disabled={row.index === 0} accessibilityRole="button" accessibilityLabel={`${t('library_queue_up')} ${music.name}`} accessibilityState={{ disabled: row.index === 0 }} onPress={() => { move(row.index - 1) }}><Text size={22} color={row.index === 0 ? colors.separator : colors.accent}>↑</Text></Pressable>
          <Pressable style={styles.action} disabled={row.index === length - 1} accessibilityRole="button" accessibilityLabel={`${t('library_queue_down')} ${music.name}`} accessibilityState={{ disabled: row.index === length - 1 }} onPress={() => { move(row.index + 1) }}><Text size={22} color={row.index === length - 1 ? colors.separator : colors.accent}>↓</Text></Pressable>
          <Pressable style={styles.action} disabled={active} accessibilityRole="button" accessibilityLabel={`${t('library_queue_remove')} ${music.name}`} accessibilityState={{ disabled: active }} onPress={() => {
            edit(() => {
              if (row.pending) playerActions.removeTempPlayList(row.index)
              else if (listId) removeQueueSong(listId, songs, row.info.musicInfo.id, current.isTempPlay ? undefined : current.musicInfo?.id)
            })
          }}><Text size={22} color={active ? colors.separator : colors.secondary}>−</Text></Pressable>
        </View>
      }} />
    </Dialog>
  </>
}

const styles = StyleSheet.create({
  open: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  hint: { paddingHorizontal: 20, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 4, minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth },
  song: { flex: 1, minHeight: 64, justifyContent: 'center', gap: 4, paddingRight: 6 },
  action: { width: 44, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
})
