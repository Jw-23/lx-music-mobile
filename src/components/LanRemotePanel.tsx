import { useEffect, useState, useRef } from 'react'
import { NativeModules, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native'
import Text from '@/components/common/Text'
import CheckBox from '@/components/common/CheckBox'
import Button from '@/components/common/Button'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import { useDesignColors } from '@/theme/design'
import { useI18n } from '@/lang'

interface Status { enabled: boolean, running: boolean, pin: string, urls: string[], error: string }
const native = NativeModules.LanRemoteModule as {
  getStatus: () => Promise<Status>
  configure: (enabled: boolean, rotate: boolean) => Promise<Status>
} | undefined
export const LanRemotePanel = () => {
  const [state, setState] = useState<Status>({ enabled: false, running: false, pin: '', urls: [], error: '' })
  const [busy, setBusy] = useState(false)
  const { height } = useWindowDimensions()
  const colors = useDesignColors()
  const t = useI18n()
  useEffect(() => {
    let mounted = true
    const refresh = () => { void native?.getStatus().then(value => { if (mounted) setState(value) }).catch(() => {}) }
    refresh()
    const timer = setInterval(refresh, 4000)
    return () => { mounted = false; clearInterval(timer) }
  }, [])
  const configure = async(enabled: boolean, rotate = false) => {
    if (!native || busy) return
    setBusy(true)
    try { setState(await native.configure(enabled, rotate)) } catch { setState(current => ({ ...current, error: t('lan_failed') })) } finally { setBusy(false) }
  }
  if (!native) return null
  return <ScrollView style={{ maxHeight: Math.max(160, height * 0.7) }} contentContainerStyle={styles.panel}>
    <CheckBox label={t('lan_enable')} check={state.enabled} disabled={busy} onChange={enabled => { void configure(enabled) }} />
    <Text color={colors.secondary} size={15} style={styles.description}>{t('lan_hint')}</Text>
    {state.running ? <>
      {state.urls.length ? state.urls.map(url => <Text key={url} selectable size={19} color={colors.accent} style={styles.address}>{url}</Text>) : <Text color={colors.secondary}>{t('lan_no_network')}</Text>}
      <Text size={13} color={colors.secondary}>{t('lan_pair_code')}</Text>
      <Text size={32} selectable style={styles.pin}>{state.pin}</Text>
      <Button disabled={busy} onPress={() => { void configure(true, true) }} style={styles.rotate}><Text color={colors.accent} size={16}>{t('lan_rotate')}</Text></Button>
    </> : null}
    {state.error ? <Text color={colors.destructive} accessibilityRole="alert">{state.error}</Text> : null}
  </ScrollView>
}
export default () => {
  const modal = useRef<DialogType>(null)
  const t = useI18n()
  const colors = useDesignColors()
  if (Platform.OS !== 'android' || !native) return null
  return <>
    <Pressable onPress={() => modal.current?.setVisible(true)} accessibilityRole="button" style={styles.entry}><Text color={colors.accent} size={17}>{t('lan_title')}</Text></Pressable>
    <Dialog ref={modal} title={t('lan_title')}><LanRemotePanel /></Dialog>
  </>
}
const styles = StyleSheet.create({ panel: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 }, description: { lineHeight: 23 }, address: { lineHeight: 28 }, pin: { fontWeight: '600', letterSpacing: 7 }, rotate: { minHeight: 44, justifyContent: 'center' }, entry: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 8 } })
