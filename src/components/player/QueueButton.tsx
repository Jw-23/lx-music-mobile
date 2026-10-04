import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import DragSortList from '@/components/common/DragSortList'
import { reorderItems } from '@/components/common/dragSort'
import { Icon } from '@/components/common/Icon'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import Text from '@/components/common/Text'
import { useDesignColors } from '@/theme/design'
import { useI18n } from '@/lang'
import { getList, updatePlayIndex } from '@/core/player/playInfo'
import { clearPlayedList } from '@/core/player/playedList'
import { getUpcomingPlayback, playQueueSong, resetRandomNextMusicInfo } from '@/core/player/player'
import { reorderUpcomingSongs, removeQueueSong, subscribePlaybackQueue } from '@/core/player/playbackQueue'
import playerState from '@/store/player/state'
import playerActions from '@/store/player/action'
import { usePlayInfo, usePlayMusicInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { toast } from '@/utils/tools'

export default () => {
  const dialog = useRef<DialogType>(null)
  const colors = useDesignColors()
  const t = useI18n()
  const current = usePlayMusicInfo()
  const playInfo = usePlayInfo()
  const mode = useSettingValue('player.togglePlayMethod')
  const { fontScale } = useWindowDimensions()
  const rowHeight = Math.max(72, Math.ceil(64 * fontScale))
  const [dismissed, setDismissed] = useState(0)
  const [, refresh] = useState(0)
  useEffect(() => {
    const update = () => { refresh(value => value + 1) }
    const unsubscribe = subscribePlaybackQueue(update)
    global.state_event.on('playTempPlayListChanged', update)
    global.app_event.on('myListMusicUpdate', update)
    global.state_event.on('playPlayedListChanged', update)
    global.dislike_event.on('dislike_changed', update)
    return () => {
      unsubscribe()
      global.state_event.off('playTempPlayListChanged', update)
      global.app_event.off('myListMusicUpdate', update)
      global.state_event.off('playPlayedListChanged', update)
      global.dislike_event.off('dislike_changed', update)
    }
  }, [])
  const listId = playInfo.playerListId
  const songs = getList(listId)
  const pending = playerState.tempPlayList
  const upcoming = getUpcomingPlayback().songs
  const rows = upcoming.map((info, index) => ({
    info,
    pending: index < pending.length,
    index: index < pending.length ? index : songs.findIndex(song => song.id === info.musicInfo.id),
    key: `${index < pending.length ? 'pending' : 'queue'}_${info.listId}_${info.musicInfo.id}_${index < pending.length ? index : ''}`,
  })).filter((row, index) => row.pending || row.info.musicInfo.id !== songs[playInfo.playerPlayIndex]?.id || (index === pending.length && upcoming.length === pending.length + 1))
  const revisionKey = JSON.stringify([dismissed, listId, mode, current.musicInfo?.id, current.isTempPlay, rows.map(row => row.key)])
  // History and cached random choices must not override an explicit queue edit.
  const edit = (change: () => void, resetSequence = false) => {
    const anchor = songs[playInfo.playerPlayIndex]?.id
    change()
    if (resetSequence) { clearPlayedList(); resetRandomNextMusicInfo() }
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
    <Dialog ref={dialog} onHide={() => { setDismissed(value => value + 1) }} title={t('library_queue')} height="80%">
      <Text size={13} color={colors.secondary} style={styles.hint}>{t('library_queue_hint')}</Text>
      {current.musicInfo ? <View style={[styles.hint, { backgroundColor: colors.secondarySurface }]}><Text size={12} color={colors.accent}>{t('library_now_playing')}</Text><Text size={17} numberOfLines={1}>{'progress' in current.musicInfo ? current.musicInfo.metadata.musicInfo.name : current.musicInfo.name}</Text></View> : null}
      <DragSortList data={rows} rowHeight={rowHeight} revisionKey={revisionKey} keyExtractor={row => row.key}
        empty={<Text color={colors.secondary} style={styles.hint}>{t('library_queue_empty')}</Text>}
        getRange={index => rows[index].pending ? [0, pending.length - 1] : [pending.length, rows.length - 1]}
        onMove={(from, to) => {
          const row = rows[from]
          if (!row || row.pending !== rows[to]?.pending) return
          edit(() => {
            if (row.pending) playerActions.moveTempPlayList(row.index, rows[to].index)
            else if (listId) {
              const ordered = reorderItems(rows.filter(item => !item.pending), from - pending.length, to - pending.length).map(item => item.info.musicInfo)
              reorderUpcomingSongs(listId, songs, playInfo.playerPlayIndex, ordered)
            }
          }, !row.pending)
        }}
        renderRow={(row, dragging, handle) => {
          const protectedSong = !row.pending && !current.isTempPlay && row.info.musicInfo.id === current.musicInfo?.id
          const music = 'progress' in row.info.musicInfo ? row.info.musicInfo.metadata.musicInfo : row.info.musicInfo
          return <View style={[styles.row, { borderBottomColor: colors.separator, backgroundColor: dragging ? colors.secondarySurface : colors.surface, height: rowHeight, borderRadius: dragging ? 12 : 0 }]}>
            <Pressable style={styles.song} accessibilityRole="button" accessibilityLabel={`${t('library_play')} ${music.name}`} onPress={async() => {
              try {
                if (row.pending) playerActions.removeTempPlayList(row.index)
                await playQueueSong(row.info.musicInfo, row.info.listId, row.pending)
              } catch { toast(t('library_play_failed')) }
            }}>
              <Text size={17} numberOfLines={1}>{music.name}</Text>
              <Text size={12} color={colors.secondary} numberOfLines={1}>{t(row.pending ? 'library_queue_priority' : 'library_queue_order', { count: rows.indexOf(row) + 1 })}{music.singer ? ` · ${music.singer}` : ''}</Text>
            </Pressable>
            <Pressable style={styles.action} disabled={protectedSong} accessibilityState={{ disabled: protectedSong }} accessibilityRole="button" accessibilityLabel={`${t('library_queue_remove')} ${music.name}`} onPress={() => {
              edit(() => {
                if (row.pending) playerActions.removeTempPlayList(row.index)
                else if (listId) removeQueueSong(listId, songs, row.info.musicInfo.id, current.isTempPlay ? undefined : current.musicInfo?.id)
              })
            }}><Text size={22} color={colors.secondary}>−</Text></Pressable>
            <View {...handle} style={styles.action} accessible accessibilityLabel={`${t('library_queue_drag')} ${music.name}`} accessibilityHint={t('library_queue_hint')}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.grip}>{[0, 1, 2].map(line => <View key={line} style={[styles.gripLine, { backgroundColor: colors.secondary }]} />)}</View>
            </View>
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
  grip: { gap: 4 },
  gripLine: { width: 18, height: 2, borderRadius: 1 },
  action: { width: 44, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
})
