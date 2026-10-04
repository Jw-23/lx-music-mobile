import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import StackTransition from '@/components/common/StackTransition'
import { useDesignColors } from '@/theme/design'
import { useI18n } from '@/lang'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import commonState from '@/store/common/state'
import { useSettingValue } from '@/store/setting/hook'
import { confirmDialog, exitApp as backHome } from '@/utils/tools'
import { exitApp, setNavActiveId } from '@/core/common'
import Main, { type SettingScreenIds } from './Main'
export type { SettingScreenIds } from './Main'
const groups = [
  [['basic', 'setting', '#8E8E93'], ['player', 'play', '#D70034'], ['lyric_desktop', 'lyric-on', '#5856D6'], ['search', 'search-2', '#007AFF'], ['list', 'album', '#FF9500']],
  [['sync', 'available_updates', '#34A853'], ['backup', 'sd-card', '#007AFF']],
  [['other', 'slider', '#8E8E93'], ['version', 'download-2', '#5856D6'], ['about', 'help', '#007AFF']],
] as const
export default () => {
  const [active, setActive] = useState<SettingScreenIds>()
  const showBack = useSettingValue('common.showBackBtn')
  const showExit = useSettingValue('common.showExitBtn')
  const colors = useDesignColors()
  const t = useI18n()
  useBackHandler(useCallback(() => {
    if (commonState.navActiveId !== 'nav_setting') return false
    if (active) { setActive(undefined); return true }
    if (Object.keys(commonState.componentIds).length === 1) { setNavActiveId(commonState.lastNavActiveId); return true }
    return false
  }, [active]))
  const detail = active ? <View style={{ flex: 1 }}>
      <View style={styles.navigation}><Pressable style={styles.back} accessibilityRole="button" onPress={() => { setActive(undefined) }}><Icon name="chevron-left" size={18} color={colors.accent} /><Text size={17} color={colors.accent}>{t('library_settings')}</Text></Pressable><Text size={17} style={{ fontWeight: '600', flex: 1, minWidth: 0, textAlign: 'right' }}>{t(`setting_${active}`)}</Text></View>
      <Text size={34} accessibilityRole="header" style={styles.title}>{t(`setting_${active}`)}</Text>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled"><Main activeId={active} /></ScrollView>
    </View> : null
  return <StackTransition detailKey={active} detail={detail}><ScrollView contentContainerStyle={styles.content}>
    <Text size={34} accessibilityRole="header" style={[styles.title, { paddingHorizontal: 0 }]}>{t('library_settings')}</Text>
    {groups.map((group, groupIndex) => <View key={groupIndex} style={[styles.group, { backgroundColor: colors.surface }]}>
      {group.map(([id, icon, background], index) => <Pressable key={id} accessibilityRole="button" onPress={() => { global.lx.settingActiveId = id; setActive(id) }} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.secondarySurface : colors.surface }]}>
        <View style={[styles.icon, { backgroundColor: background }]}><Icon name={icon} size={18} color="#FFFFFF" /></View>
        <View style={[styles.label, { borderBottomColor: colors.separator, borderBottomWidth: index < group.length - 1 ? StyleSheet.hairlineWidth : 0 }]}><Text size={17} style={{ flex: 1 }}>{t(`setting_${id}`)}</Text><Icon name="chevron-right" size={12} color={colors.secondary} /></View>
      </Pressable>)}
    </View>)}
    {showBack || showExit ? <View style={[styles.group, { backgroundColor: colors.surface }]}>
      {showBack ? <Pressable style={styles.row} accessibilityRole="button" onPress={backHome}><Text size={17} color={colors.accent}>{t('back_home')}</Text></Pressable> : null}
      {showExit ? <Pressable style={styles.row} accessibilityRole="button" onPress={async() => { if (await confirmDialog({ message: t('exit_app_tip') })) exitApp('Exit Btn') }}><Text size={17} color={colors.destructive}>{t('nav_exit')}</Text></Pressable> : null}
    </View> : null}
  </ScrollView></StackTransition>
}
const styles = StyleSheet.create({
  title: { fontWeight: '700', paddingHorizontal: 20, paddingBottom: 20 },
  content: { padding: 20 },
  group: { borderRadius: 14, overflow: 'hidden', marginBottom: 28 },
  row: { minHeight: 56, paddingLeft: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, minHeight: 56, paddingVertical: 12, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  navigation: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  back: { flexShrink: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
})
