import { memo, useCallback, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useKeyboard, useHorizontalMode } from '@/utils/hooks'
import { useDesignColors } from '@/theme/design'
import { useSettingValue } from '@/store/setting/hook'
import { useIsPlay, usePlayerMusicInfo, usePlayMusicInfo, useProgress, useStatusText } from '@/store/player/hook'
import { usePageVisible } from '@/store/common/hook'
import { COMPONENT_IDS, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useI18n } from '@/lang'
import { setNavActiveId } from '@/core/common'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { toast } from '@/utils/tools'

export default memo(({ isHome = false }: { isHome?: boolean }) => {
  const { keyboardShown } = useKeyboard()
  const colors = useDesignColors()
  const t = useI18n()
  const music = usePlayerMusicInfo()
  const current = usePlayMusicInfo()
  const isPlay = useIsPlay()
  const status = useStatusText()
  const [autoUpdate, setAutoUpdate] = useState(true)
  const [trackWidth, setTrackWidth] = useState(0)
  const wide = useHorizontalMode()
  const allowSeek = useSettingValue('common.allowProgressBarSeek')
  const seek = allowSeek && !wide
  const { progress, maxPlayTime, nowPlayTimeStr, maxPlayTimeStr } = useProgress(autoUpdate)
  const autoHide = useSettingValue('common.autoHidePlayBar')
  usePageVisible([COMPONENT_IDS.home], useCallback((visible) => { if (isHome) setAutoUpdate(visible) }, [isHome]))
  if (autoHide && keyboardShown) return null
  const open = () => {
    if (music.id) navigations.pushPlayDetailScreen(commonState.componentIds.home!)
    else setNavActiveId('nav_search')
  }
  const info = current.musicInfo
  const local = info && ('progress' in info ? info.metadata.musicInfo : info).source === 'local'
  const playbackStatus = Object.values(global.i18n.messages).some(message => message.lyric__load_error === status) ? '' : status
  const subtitle = music.id ? playbackStatus || music.singer || t(local ? 'library_local_music' : 'library_now_playing') : t('library_empty_hint')
  return <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
    <View style={styles.row}>
      <Pressable style={styles.info} onPress={open} onLongPress={() => { if (current.listId) global.app_event.jumpListPosition() }} accessibilityRole="button" accessibilityLabel={music.id ? `${t('library_now_playing')} ${music.name}` : t('library_choose_music')}>
        <Image url={music.pic} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic} style={styles.art} />
        <View style={styles.text}><Text size={16} numberOfLines={1} style={{ fontWeight: '500' }}>{music.name || t('library_choose_music')}</Text><Text size={12} color={colors.secondary} numberOfLines={1}>{subtitle}</Text></View>
      </Pressable>
      <Pressable disabled={!music.id} onPress={async() => { try { await playPrev() } catch { toast(t('library_play_failed')) } }} style={styles.button} accessibilityRole="button" accessibilityLabel={t('library_previous')} accessibilityState={{ disabled: !music.id }}><Icon name="prevMusic" size={24} color={colors.text} /></Pressable>
      <Pressable disabled={!music.id} onPress={togglePlay} style={styles.button} accessibilityRole="button" accessibilityLabel={t(isPlay ? 'player_pause' : 'library_play')} accessibilityState={{ disabled: !music.id }}><Icon name={isPlay ? 'pause' : 'play'} size={23} color={colors.text} /></Pressable>
      <Pressable disabled={!music.id} onPress={async() => { try { await playNext() } catch { toast(t('library_play_failed')) } }} style={styles.button} accessibilityRole="button" accessibilityLabel={t('library_next')} accessibilityState={{ disabled: !music.id }}><Icon name="nextMusic" size={24} color={colors.text} /></Pressable>
    </View>
    <Pressable disabled={!seek || !music.id || maxPlayTime <= 0} accessibilityRole={seek ? 'adjustable' : 'progressbar'} accessibilityLabel={t('library_playback_progress')} accessibilityValue={{ min: 0, max: 100, now: Math.round((Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0) * 100) }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={({ nativeEvent }) => { if (seek && maxPlayTime > 0) global.app_event.setProgress(Math.max(0, Math.min(maxPlayTime, progress * maxPlayTime + (nativeEvent.actionName === 'increment' ? 10 : -10)))) }} onLayout={({ nativeEvent }) => { setTrackWidth(nativeEvent.layout.width) }} onPress={({ nativeEvent }) => { if (trackWidth > 0) global.app_event.setProgress(Math.max(0, Math.min(1, nativeEvent.locationX / trackWidth)) * maxPlayTime) }} style={{ marginHorizontal: 14, minHeight: seek ? 44 : 2, justifyContent: 'center' }}>
      {seek ? <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}><Text size={11} color={colors.secondary}>{nowPlayTimeStr}</Text><Text size={11} color={colors.secondary}>{maxPlayTimeStr}</Text></View> : null}
      <View style={[styles.track, { backgroundColor: colors.separator }]}><View style={{ height: 2, width: `${(Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0) * 100}%`, backgroundColor: colors.accent }} /></View>
    </Pressable>
  </View>
})

const styles = StyleSheet.create({
  container: { marginHorizontal: 8, marginTop: 6, marginBottom: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 4, minHeight: 64 },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  art: { width: 42, height: 42, borderRadius: 8 },
  text: { flex: 1, paddingLeft: 12, paddingRight: 6 },
  button: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  track: { height: 2 },
})
