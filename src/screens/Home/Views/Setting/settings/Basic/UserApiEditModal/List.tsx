import { useCallback } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { confirmDialog, toast } from '@/utils/tools'
import { useDesignColors } from '@/theme/design'
import { useI18n } from '@/lang'
import { useStatus, useUserApiList, state as userApiState } from '@/store/userApi'
import { useSettingValue } from '@/store/setting/hook'
import { removeUserApi, setUserApiAllowShowUpdateAlert } from '@/core/userApi'
import CheckBox from '@/components/common/CheckBox'
import { Icon } from '@/components/common/Icon'
import settingState from '@/store/setting/state'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { setApiSource } from '@/core/apiSource'

export default () => {
  const list = useUserApiList()
  const activeId = useSettingValue('common.apiSource')
  const status = useStatus()
  const colors = useDesignColors()
  const t = useI18n()
  const handleRemove = useCallback(async(id: string, name: string) => {
    if (!await confirmDialog({
      message: global.i18n.t('user_api_remove_tip', { name }),
      cancelButtonText: global.i18n.t('cancel_button_text_2'),
      confirmButtonText: global.i18n.t('confirm_button_text'),
      bgClose: false,
    })) return
    try {
      await removeUserApi([id])
      if (settingState.setting['common.apiSource'] === id) {
        const fallback = apiSourceInfo.find(api => !api.disabled)?.id ?? userApiState.list[0]?.id ?? ''
        setApiSource(fallback)
      }
    } catch (error: unknown) { toast(error instanceof Error ? error.message : String(error), 'long') }
  }, [])
  const changeUpdateAlert = async(id: string, enabled: boolean) => {
    try { await setUserApiAllowShowUpdateAlert(id, enabled) } catch (error: unknown) { toast(error instanceof Error ? error.message : String(error), 'long') }
  }
  return <View style={styles.section}>
    <View style={styles.heading}><Text size={20} style={{ fontWeight: '600', flex: 1 }} accessibilityRole="header">{t('user_api_imported_sources')}</Text><Text size={13} color={colors.secondary}>{list.length} / 20</Text></View>
    <Text size={13} color={colors.secondary}>{t('user_api_select_hint')}</Text>
    {list.length ? list.map(item => {
      const selected = item.id === activeId
      const initing = selected && !status.status && status.message === 'initing'
      const failed = selected && !status.status && !initing
      return <View key={item.id} style={[styles.card, { backgroundColor: colors.secondarySurface }]}>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, ${t(failed ? 'user_api_retry' : 'user_api_use')}`} accessibilityState={{ selected, disabled: selected && !failed }} disabled={selected && !failed} onPress={() => { setApiSource(item.id) }} style={({ pressed }) => [styles.select, { opacity: pressed ? 0.6 : 1 }]}>
            <Text size={17} style={{ fontWeight: '600' }}>{item.name}</Text>
            {item.version || item.author ? <Text size={13} color={colors.secondary}>{[/^\d/.test(item.version) ? `v${item.version}` : item.version, item.author].filter(Boolean).join(' · ')}</Text> : null}
            {item.description ? <Text size={13} color={colors.secondary} style={{ lineHeight: 19 }}>{item.description}</Text> : null}
          </Pressable>
          <Button accessibilityRole="button" accessibilityLabel={t('user_api_remove_label', { name: item.name })} onPress={() => { void handleRemove(item.id, item.name) }} style={styles.remove}><Icon name="remove" size={18} color={colors.destructive} /></Button>
        </View>
        {selected ? <View style={styles.status} accessibilityLiveRegion="polite"><Text size={13} color={failed ? colors.destructive : colors.accent} style={{ flex: 1 }}>{t(status.status ? 'setting_basic_source_status_success' : initing ? 'setting_basic_source_status_initing' : 'setting_basic_source_status_failed')}</Text>{failed ? <Button accessibilityRole="button" onPress={() => { setApiSource(item.id) }} style={styles.retry}><Text size={15} color={colors.accent}>{t('user_api_retry')}</Text></Button> : <Text size={17} color={colors.accent}>✓</Text>}</View> : <Button accessibilityRole="button" onPress={() => { setApiSource(item.id) }} style={styles.retry}><Text size={15} color={colors.accent}>{t('user_api_use')}</Text></Button>}
        <View style={[styles.options, { borderTopColor: colors.separator }]}><CheckBox check={item.allowShowUpdateAlert} label={t('user_api_allow_show_update_alert')} onChange={enabled => { void changeUpdateAlert(item.id, enabled) }} size={0.86} /></View>
      </View>
    }) : <View style={[styles.empty, { backgroundColor: colors.secondarySurface }]}><Icon name="sd-card" size={28} color={colors.secondary} /><Text size={15} color={colors.secondary} style={{ textAlign: 'center' }}>{t('user_api_empty')}</Text></View>}
  </View>
}
const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { padding: 16, paddingBottom: 8, borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  select: { flex: 1, minHeight: 44, gap: 5, paddingVertical: 4 },
  remove: { alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  retry: { alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 4 },
  options: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  empty: { padding: 24, borderRadius: 16, alignItems: 'center', gap: 12 },
})
