import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import StackTransition from '@/components/common/StackTransition'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { useI18n } from '@/lang'
import commonState from '@/store/common/state'
import Main, { type SettingScreenIds } from '../Home/Views/Setting/Main'
import Source from '../Home/Views/Setting/settings/Basic/Source'
import BasicSettings from './BasicSettings'
import { TV_COLORS as c } from '@/theme/tv'

const items = [
  { id: 'source', title: 'setting_basic_source', icon: 'music_time' },
  { id: 'player', title: 'setting_player', icon: 'play' },
  { id: 'list', title: 'setting_list', icon: 'album' },
  { id: 'basic', title: 'setting_basic', icon: 'slider' },
  { id: 'backup', title: 'setting_backup', icon: 'sd-card' },
  { id: 'version', title: 'setting_version', icon: 'available_updates' },
] as const
export default () => {
  const [active, setActive] = useState<typeof items[number]['id']>()
  const t = useI18n()
  useBackHandler(useCallback(() => { if (commonState.navActiveId !== 'nav_setting' || !active) return false; setActive(undefined); return true }, [active]))
  const selected = items.find(item => item.id === active)
  const detail = selected ? <View style={{ flex: 1 }}>
    <Pressable onPress={() => { setActive(undefined) }} style={styles.back} accessibilityRole="button" accessibilityLabel={t('library_back')}><Icon name="chevron-left" rawSize={19} color={c.accent} /><Text color={c.accent} size={17}>{t('library_settings')}</Text></Pressable>
    <ScrollView contentContainerStyle={styles.detail}>{active === 'source' ? <Source /> : active === 'basic' ? <BasicSettings /> : <Main activeId={active as SettingScreenIds} />}</ScrollView>
  </View> : null
  return <StackTransition detailKey={active} detail={detail}>
    <ScrollView contentContainerStyle={styles.overview}>
      <Text size={28} style={styles.title}>{t('library_settings')}</Text>
      <View style={styles.grid}>{items.map(item => <Pressable key={item.id} onPress={() => { setActive(item.id) }} accessibilityRole="button" style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : 1 }]}><Icon name={item.icon} rawSize={25} color={c.accent} /><Text size={18} style={{ fontWeight: '500' }}>{t(item.title)}</Text><Icon name="chevron-right" rawSize={14} color={c.secondary} /></Pressable>)}</View>
    </ScrollView>
  </StackTransition>
}
const styles = StyleSheet.create({ overview: { padding: 12 }, title: { fontWeight: '600', marginBottom: 24, marginTop: 8 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, card: { flexBasis: '30%', flexGrow: 1, minWidth: 180, minHeight: 94, borderRadius: 16, padding: 20, backgroundColor: c.surface, flexDirection: 'row', gap: 14, alignItems: 'center', justifyContent: 'space-between' }, back: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12 }, detail: { padding: 20 } })
