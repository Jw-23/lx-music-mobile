import { useEffect, useRef } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useNavActiveId } from '@/store/common/hook'
import { setNavActiveId } from '@/core/common'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import Main from '../Home/Vertical/Main'
import LanRemoteButton from '@/components/LanRemotePanel'
import { TV_COLORS as c } from '@/theme/tv'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import TVButton from './Button'
import Transport from './Transport'

const tabs = [{ id: 'nav_love', title: 'library_title' }, { id: 'nav_songlist', title: 'library_discover' }, { id: 'nav_search', title: 'library_search' }] as const
export default () => {
  const active = useNavActiveId()
  const initial = useRef(active).current
  const t = useI18n()
  const discover = active === 'nav_songlist' || active === 'nav_top'
  useEffect(() => {
    const showMenu = (visible: boolean) => { if (visible) setNavActiveId('nav_setting') }
    global.app_event.on('changeMenuVisible', showMenu)
    return () => { global.app_event.off('changeMenuVisible', showMenu) }
  }, [])
  return <View style={styles.root}>
    <StatusBar />
    <View style={styles.header}>
      <View style={styles.brand}><Text size={23} style={styles.brandText}>LX Music</Text><Text size={11} color={c.secondary} style={styles.badge}>TV</Text></View>
      <View style={styles.tabs}>{tabs.map(tab => {
        const selected = tab.id === active || (tab.id === 'nav_songlist' && discover)
        return <Pressable key={tab.id} hasTVPreferredFocus={tab.id === initial || (tab.id === 'nav_songlist' && initial === 'nav_top')} onPress={() => { setNavActiveId(tab.id) }} accessibilityRole="tab" accessibilityState={{ selected }} style={({ pressed }) => [styles.tab, { backgroundColor: selected ? c.elevated : 'transparent', opacity: pressed ? 0.7 : 1 }]}><Text size={17} color={selected ? c.text : c.secondary} style={{ fontWeight: selected ? '600' : '400' }}>{t(tab.title)}</Text></Pressable>
      })}</View>
      <LanRemoteButton compact />
      <TVButton icon="setting" preferred={initial === 'nav_setting'} label={t('library_settings')} onPress={() => { setNavActiveId('nav_setting') }} />
    </View>
    {discover ? <View style={styles.discovery}>{(['nav_songlist', 'nav_top'] as const).map(id => <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: active === id }} onPress={() => { setNavActiveId(id) }} style={styles.filter}><Text color={active === id ? c.accent : c.secondary} size={15}>{t(id === 'nav_top' ? 'library_charts' : 'library_playlists')}</Text></Pressable>)}</View> : null}
    <View style={styles.content}><Main /></View>
    <Transport onOpen={() => { if (commonState.componentIds.home) navigations.pushPlayDetailScreen(commonState.componentIds.home); else setNavActiveId('nav_search') }} />
  </View>
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12, paddingBottom: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12 },
  brandText: { fontWeight: '700', letterSpacing: -0.6 },
  badge: { borderWidth: 1, borderColor: c.separator, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  tabs: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tab: { minHeight: 46, minWidth: 90, paddingHorizontal: 22, justifyContent: 'center', alignItems: 'center', borderRadius: 23 },
  discovery: { flexDirection: 'row', paddingHorizontal: 12, gap: 12 },
  filter: { minHeight: 40, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 20 },
  content: { flex: 1, overflow: 'hidden' },
})
