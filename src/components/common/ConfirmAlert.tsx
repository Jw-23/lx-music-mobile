import { forwardRef, useImperativeHandle, useRef } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Dialog, { type DialogType } from './Dialog'
import { useI18n } from '@/lang'
import { useDesignColors } from '@/theme/design'
import Text from './Text'
export interface ConfirmAlertProps {
  onCancel?: () => void
  onHide?: () => void
  onConfirm?: () => void
  keyHide?: boolean
  bgHide?: boolean
  closeBtn?: boolean
  title?: string
  text?: string
  cancelText?: string
  confirmText?: string
  showConfirm?: boolean
  disabledConfirm?: boolean
  reverseBtn?: boolean
  children?: React.ReactNode | React.ReactNode[]
}
export interface ConfirmAlertType { setVisible: (visible: boolean) => void }
export default forwardRef<ConfirmAlertType, ConfirmAlertProps>(({ onHide, onCancel, onConfirm = () => {}, keyHide, bgHide, closeBtn = false, title = '', text = '', cancelText = '', confirmText = '', showConfirm = true, disabledConfirm = false, children, reverseBtn = false }, ref) => {
  const t = useI18n()
  const colors = useDesignColors()
  const dialog = useRef<DialogType>(null)
  useImperativeHandle(ref, () => ({ setVisible(visible) { dialog.current?.setVisible(visible) } }))
  const cancel = () => { dialog.current?.setVisible(false); onCancel?.() }
  return <Dialog ref={dialog} presentation="alert" onHide={onHide} keyHide={keyHide} bgHide={bgHide} closeBtn={closeBtn} title={title}>
    <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {children ?? <Text size={17} style={{ textAlign: 'center', lineHeight: 25 }}>{text}</Text>}
    </ScrollView>
    <View style={[styles.buttons, { borderTopColor: colors.separator, flexDirection: reverseBtn ? 'row-reverse' : 'row' }]}>
      <Pressable onPress={cancel} accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.secondarySurface }]}><Text size={17} color={colors.accent} style={{ textAlign: 'center' }}>{cancelText || t('cancel')}</Text></Pressable>
      {showConfirm ? <Pressable onPress={onConfirm} disabled={disabledConfirm} accessibilityRole="button" style={({ pressed }) => [styles.button, { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.separator, opacity: disabledConfirm ? 0.4 : 1 }, pressed && { backgroundColor: colors.secondarySurface }]}><Text size={17} color={colors.accent} style={{ fontWeight: '600', textAlign: 'center' }}>{confirmText || t('confirm')}</Text></Pressable> : null}
    </View>
  </Dialog>
})
const styles = StyleSheet.create({
  content: { padding: 24 },
  buttons: { borderTopWidth: StyleSheet.hairlineWidth, flexShrink: 0 },
  button: { flex: 1, minHeight: 50, padding: 12, alignItems: 'center', justifyContent: 'center' },
})
