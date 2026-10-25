import { useRef } from 'react'
import { Pressable, ScrollView, StyleSheet } from 'react-native'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import { Icon } from '@/components/common/Icon'
import { useDesignColors } from '@/theme/design'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import AudioOutput from './AudioOutput'

export default () => {
  const dialog = useRef<DialogType>(null)
  const t = useI18n()
  const c = useDesignColors()
  const volume = useSettingValue('player.volume')
  return <>
    <Pressable style={styles.open} accessibilityRole="button" accessibilityLabel={t('audio_output')} onPress={() => { dialog.current?.setVisible(true) }}><Icon name={volume === 0 ? 'volume-mute' : 'volume-medium'} size={22} color={c.secondary} /></Pressable>
    <Dialog ref={dialog} title={t('audio_output')}><ScrollView contentContainerStyle={styles.content}><AudioOutput /></ScrollView></Dialog>
  </>
}
const styles = StyleSheet.create({ open: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 }, content: { paddingHorizontal: 20, paddingBottom: 24 } })
