import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, View } from 'react-native'
import Text from '@/components/common/Text'
import Input from '@/components/common/Input'
import Button from '@/components/common/Button'
import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import { Icon } from '@/components/common/Icon'
import { USER_API_SOURCE_FILE_EXT_RXP } from '@/config/constant'
import { useI18n } from '@/lang'
import { useDesignColors } from '@/theme/design'
import { useUserApiList, state as userApiState } from '@/store/userApi'
import { importUserApi } from '@/core/userApi'
import { setApiSource } from '@/core/apiSource'
import { useSettingValue } from '@/store/setting/hook'
import { readFile } from '@/utils/fs'
import { httpFetch } from '@/utils/request'
import { createSourceImport, type ImportState } from './importFlow'

export interface ImportPanelType { cancel: () => void }
export default forwardRef<ImportPanelType, {}>((props, ref) => {
  const t = useI18n()
  const colors = useDesignColors()
  const list = useUserApiList()
  const activeId = useSettingValue('common.apiSource')
  const [method, setMethod] = useState<'file' | 'url'>('file')
  const [url, setUrl] = useState('')
  const [state, setState] = useState<ImportState>({ phase: 'idle' })
  const filePicker = useRef<ChoosePathType>(null)
  const flow = useMemo(() => createSourceImport({
    count: () => userApiState.list.length,
    read: readFile,
    save: importUserApi,
    download: url => {
      const request = httpFetch(url, { method: 'get', timeout: 15000 })
      return { promise: request.promise, cancel: () => { request.cancelHttp() } }
    },
    update: setState,
  }), [])
  useImperativeHandle(ref, () => ({ cancel: flow.cancel }), [flow])
  useEffect(() => () => { flow.dispose() }, [flow])
  const busy = state.phase !== 'idle'
  const error = state.error
    ? state.error.kind === 'url' ? t('user_api_import_invalid_url')
      : state.error.kind === 'limit' ? t('user_api_max_tip')
        : state.error.kind === 'script' ? t('user_api_add_failed_tip')
          : state.error.kind === 'http' ? t('user_api_import_http_error', { code: state.error.message ?? '' })
            : t('user_api_import_failed_tip', { message: state.error.message ?? '' })
    : ''
  const handleImport = () => {
    Keyboard.dismiss()
    void flow.importUrl(url)
  }
  const chooseFile = () => {
    filePicker.current?.show({ title: t('user_api_import_desc'), dirOnly: false, filter: USER_API_SOURCE_FILE_EXT_RXP })
  }
  return <View style={styles.section}>
    <Text size={20} style={styles.heading} accessibilityRole="header">{t('user_api_btn_import')}</Text>
    <View style={[styles.segment, { backgroundColor: colors.secondarySurface }]} accessibilityRole="tablist">
      {(['file', 'url'] as const).map(value => <Pressable key={value} disabled={busy} accessibilityRole="tab" accessibilityState={{ selected: method === value, disabled: busy }} onPress={() => { Keyboard.dismiss(); setMethod(value); setState(current => ({ phase: current.phase, imported: current.imported })) }} style={({ pressed }) => [styles.segmentItem, { backgroundColor: method === value ? colors.surface : 'transparent', opacity: pressed ? 0.6 : 1 }]}>
        <Text size={15} style={{ fontWeight: method === value ? '600' : '400' }}>{t(value === 'file' ? 'user_api_btn_import_local' : 'user_api_btn_import_online')}</Text>
      </Pressable>)}
    </View>
    <Text size={13} color={colors.secondary} style={styles.hint}>{t(method === 'file' ? 'user_api_import_file_hint' : 'user_api_import_url_hint')}</Text>
    {method === 'url' ? <View style={[styles.input, { backgroundColor: colors.secondarySurface }]}>
      <Input value={url} onChangeText={setUrl} placeholder="https://" keyboardType="url" autoCorrect={false} autoCapitalize="none" editable={!busy} returnKeyType="go" onSubmitEditing={handleImport} accessibilityLabel={t('user_api_btn_import_online_input_tip')} />
    </View> : null}
    <Button disabled={busy || (method === 'url' && !url.trim())} accessibilityRole="button" accessibilityState={{ busy, disabled: busy || (method === 'url' && !url.trim()) }} onPress={method === 'file' ? chooseFile : handleImport} style={[styles.action, { backgroundColor: colors.accent }]}>
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Icon name={method === 'file' ? 'sd-card' : 'download-2'} size={18} color="#FFFFFF" />}
      <Text size={17} color="#FFFFFF" style={{ fontWeight: '600', flexShrink: 1 }}>{busy ? t(state.phase === 'saving' ? 'user_api_import_saving' : 'user_api_btn_import_online_input_loading') : t(method === 'file' ? 'user_api_import_choose_file' : 'user_api_btn_import_online_input_confirm')}</Text>
    </Button>
    {error ? <Text size={13} color={colors.destructive} accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.feedback}>{error}</Text> : null}
    {state.imported && list.some(api => api.id === state.imported!.id) ? <View style={[styles.success, { backgroundColor: colors.secondarySurface }]} accessibilityLiveRegion="polite">
      <View style={{ flex: 1, gap: 4 }}><Text size={15} style={{ fontWeight: '600' }}>{state.imported.name}</Text><Text size={13} color={colors.secondary}>{t('user_api_import_ready')}</Text></View>
      <Button disabled={activeId === state.imported.id} onPress={() => { if (userApiState.list.some(api => api.id === state.imported!.id)) setApiSource(state.imported!.id) }} accessibilityRole="button" style={styles.use}><Text size={15} color={colors.accent}>{t(activeId === state.imported.id ? 'user_api_selected' : 'user_api_use')}</Text></Button>
    </View> : null}
    <ChoosePath ref={filePicker} onConfirm={path => { void flow.importFile(path) }} />
  </View>
})
const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { fontWeight: '600' },
  segment: { padding: 3, borderRadius: 12, flexDirection: 'row' },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 8 },
  hint: { lineHeight: 20 },
  input: { borderRadius: 12, paddingRight: 8 },
  action: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  feedback: { lineHeight: 20 },
  success: { borderRadius: 14, paddingLeft: 16, paddingVertical: 8, paddingRight: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  use: { paddingHorizontal: 12, justifyContent: 'center' },
})
