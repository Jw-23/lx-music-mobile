import { useEffect } from 'react'
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { pop } from '@/navigation'
import { useI18n } from '@/lang'
import { TV_COLORS as c } from '@/theme/tv'
import LyricsView from '../PlayDetail/components/LyricsView'
import LanRemoteButton from '@/components/LanRemotePanel'
import { getTVArtworkSize } from './layout'
import Transport from './Transport'
import TVButton from './Button'

export default ({ componentId }: { componentId: string }) => {
  useEffect(() => {
    screenkeepAwake()
    const listener = AppState.addEventListener('change', state => { if (state === 'active') screenkeepAwake(); else screenUnkeepAwake() })
    return () => { listener.remove(); screenUnkeepAwake() }
  }, [])
  const music = usePlayerMusicInfo()
  const { width, height } = useWindowDimensions()
  const size = getTVArtworkSize(width, height)
  const t = useI18n()
  return <View style={styles.root}>
    <View style={styles.header}><TVButton icon="chevron-left" label={t('library_back')} onPress={() => { void pop(componentId) }} /><Text color={c.secondary} size={16} style={{ flex: 1 }}>{t('library_now_playing')}</Text><LanRemoteButton compact /></View>
    <View style={styles.content}>
      <View style={styles.artwork}>
        <Image url={music.pic} resizeMode="cover" style={{ width: size, height: size, borderRadius: 18, backgroundColor: c.surface }} />
        <Text numberOfLines={2} size={24} style={styles.title}>{music.name || t('library_choose_music')}</Text>
        <Text numberOfLines={1} size={16} color={c.secondary}>{music.singer}</Text>
      </View>
      <View style={styles.lyrics}><LyricsView orientation="horizontal" /></View>
    </View>
    <Transport />
  </View>
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: c.background }, header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 8 }, content: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 26 }, artwork: { width: '38%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, gap: 10 }, title: { fontWeight: '600', textAlign: 'center', marginTop: 6 }, lyrics: { flex: 1, minWidth: 0 } })
