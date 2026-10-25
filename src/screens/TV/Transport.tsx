import { Pressable, StyleSheet, View } from 'react-native'
import { useIsPlay, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { seekTVPosition } from '@/core/player/tvRemoteActions'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import QueueButton from '@/components/player/QueueButton'
import { TV_COLORS as c } from '@/theme/tv'
import { setNavActiveId } from '@/core/common'
import { toast } from '@/utils/tools'
import TVButton from './Button'

export default ({ onOpen }: { onOpen?: () => void }) => {
  const t = useI18n()
  const music = usePlayerMusicInfo()
  const playing = useIsPlay()
  const { progress, nowPlayTime, maxPlayTime, nowPlayTimeStr, maxPlayTimeStr } = useProgress()
  const step = (direction: number) => {
    const time = seekTVPosition(nowPlayTime, maxPlayTime, direction)
    if (time !== null) global.app_event.setProgress(time)
  }
  const switchSong = async(previous: boolean) => {
    try { await (previous ? playPrev() : playNext()) } catch { toast(t('library_play_failed')) }
  }
  return <View style={styles.container}>
    <View style={[styles.row, !onOpen && styles.center]}>
      {onOpen ? <Pressable onPress={() => { if (music.id) onOpen(); else setNavActiveId('nav_search') }} accessibilityRole="button" accessibilityLabel={t(music.id ? 'library_now_playing' : 'library_choose_music')} style={styles.info}>
        <Image url={music.pic} style={styles.art} />
        <View style={styles.titles}><Text size={17} numberOfLines={1} style={{ fontWeight: '600' }}>{music.name || t('library_choose_music')}</Text><Text size={13} numberOfLines={1} color={c.secondary}>{music.singer || t('library_empty_hint')}</Text></View>
      </Pressable> : <Pressable disabled={maxPlayTime <= 0} onPress={() => { step(-1) }} accessibilityRole="button" accessibilityLabel={t('tv_rewind')} style={styles.seek}><Text size={15} color={c.secondary}>−10</Text></Pressable>}
      <TVButton icon="prevMusic" label={t('library_previous')} onPress={() => { void switchSong(true) }} disabled={!music.id} />
      <TVButton primary icon={playing ? 'pause' : 'play'} label={t(playing ? 'player_pause' : 'library_play')} onPress={togglePlay} disabled={!music.id} />
      <TVButton icon="nextMusic" label={t('library_next')} onPress={() => { void switchSong(false) }} disabled={!music.id} />
      {!onOpen ? <Pressable disabled={maxPlayTime <= 0} onPress={() => { step(1) }} accessibilityRole="button" accessibilityLabel={t('tv_forward')} style={styles.seek}><Text size={15} color={c.secondary}>+10</Text></Pressable> : null}
      <QueueButton />
    </View>
    <View style={styles.progressRow}>
      {!onOpen ? <Text color={c.secondary} size={12}>{nowPlayTimeStr}</Text> : null}
      <View style={styles.track}><View style={[styles.fill, { width: `${Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) * 100 : 0}%` }]} /></View>
      {!onOpen ? <Text color={c.secondary} size={12}>{maxPlayTimeStr}</Text> : null}
    </View>
  </View>
}
const styles = StyleSheet.create({
  container: { paddingTop: 10, paddingHorizontal: 12, paddingBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 62 },
  center: { justifyContent: 'center', gap: 22 },
  info: { flex: 1, minWidth: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 12 },
  art: { width: 42, height: 42, borderRadius: 10 },
  titles: { flex: 1, minWidth: 0, gap: 4 },
  seek: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: c.surface },
  progressRow: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { flex: 1, height: 2, backgroundColor: c.separator, borderRadius: 1, overflow: 'hidden' },
  fill: { height: 2, backgroundColor: c.accent },
})
