import { useEffect } from 'react'
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { setNavActiveId } from '@/core/common'
import { useHorizontalMode } from '@/utils/hooks'
import { useI18n } from '@/lang'
import { useDesignColors, design } from '@/theme/design'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import PlayerBar from '@/components/player/PlayerBar'
import Main from './Vertical/Main'
import SearchTypeSelector from './Views/Search/SearchTypeSelector'

const tabs = [
  { id: 'nav_love', icon: 'album', title: 'library_title' },
  { id: 'nav_songlist', icon: 'home', title: 'library_discover' },
  { id: 'nav_top', icon: 'leaderboard', title: 'library_charts' },
  { id: 'nav_search', icon: 'search-2', title: 'library_search' },
  { id: 'nav_setting', icon: 'setting', title: 'library_settings' },
] as const

export default () => {
  const active = useNavActiveId()
  const colors = useDesignColors()
  const wide = useHorizontalMode()
  const statusHeight = useStatusbarHeight()
  const t = useI18n()
  useEffect(() => {
    // Older screens use this event to navigate to settings.
    const showMenu = (visible: boolean) => { if (visible) setNavActiveId('nav_setting') }
    global.app_event.on('changeMenuVisible', showMenu)
    return () => { global.app_event.off('changeMenuVisible', showMenu) }
  }, [])

  const navigationContent = (
    <>
      {wide ? <Text size={24} style={styles.brand}>LX Music</Text> : null}
      {tabs.map(tab => {
        const selected = active === tab.id
        return <Pressable key={tab.id} onPress={() => { setNavActiveId(tab.id) }} accessibilityRole="tab" accessibilityLabel={t(tab.title)} accessibilityState={{ selected }} style={[wide ? styles.sidebarItem : styles.tab, wide && selected ? { backgroundColor: colors.secondarySurface } : null]}>
          <Icon name={tab.icon} size={wide ? 22 : 23} color={selected ? colors.accent : colors.secondary} />
          <Text size={wide ? 17 : 10} color={selected ? colors.accent : colors.secondary} style={wide ? styles.sidebarLabel : styles.tabLabel}>{t(tab.title)}</Text>
        </Pressable>
      })}
    </>
  )
  const navigation = wide
    ? <ScrollView style={[styles.sidebar, { backgroundColor: colors.surface, borderColor: colors.separator }]} contentContainerStyle={{ padding: 16 }}>{navigationContent}</ScrollView>
    : <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.separator }]}>{navigationContent}</View>
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface, paddingTop: Platform.OS === 'android' ? statusHeight : 0 }]}>
      <StatusBar />
      <View style={[styles.body, wide ? styles.row : null, { backgroundColor: colors.background }]}>
        {wide ? navigation : null}
        <View style={styles.content}>
          {active !== 'nav_love' && active !== 'nav_setting' ? <View style={styles.header}>
            <Text size={design.type.largeTitle} style={styles.title} accessibilityRole="header">{t(tabs.find(tab => tab.id === active)!.title)}</Text>
            {active === 'nav_search' ? <SearchTypeSelector /> : null}
          </View> : null}
          <Main />
          <PlayerBar isHome />
          {!wide ? navigation : null}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1 },
  row: { flexDirection: 'row' },
  content: { flex: 1, overflow: 'hidden' },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontWeight: '700', letterSpacing: 0.3 },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, minHeight: 60, paddingHorizontal: 6 },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', paddingVertical: 7 },
  tabLabel: { marginTop: 4, fontWeight: '500' },
  sidebar: { width: 210, flexGrow: 0, flexShrink: 0, borderRightWidth: StyleSheet.hairlineWidth },
  brand: { fontWeight: '700', marginVertical: 16, paddingLeft: 12 },
  sidebarItem: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 12, marginBottom: 6 },
  sidebarLabel: { marginLeft: 14, fontWeight: '500' },
})
