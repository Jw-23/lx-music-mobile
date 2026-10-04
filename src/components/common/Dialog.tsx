import { forwardRef, useImperativeHandle, useRef } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, View } from 'react-native'
import Modal, { type ModalType } from './Modal'
import Text from './Text'
import { Icon } from './Icon'
import { useDesignColors } from '@/theme/design'
import { useI18n } from '@/lang'

export interface DialogProps {
  onHide?: () => void
  keyHide?: boolean
  bgHide?: boolean
  closeBtn?: boolean
  title?: string
  children: React.ReactNode | React.ReactNode[]
  height?: number | `${number}%`
  presentation?: 'sheet' | 'alert'
}
export interface DialogType { setVisible: (visible: boolean) => void }
export default forwardRef<DialogType, DialogProps>(({ onHide, keyHide = true, bgHide = true, closeBtn = true, title = '', children, height, presentation = 'sheet' }, ref) => {
  const modal = useRef<ModalType>(null)
  const colors = useDesignColors()
  const t = useI18n()
  const alert = presentation === 'alert'
  useImperativeHandle(ref, () => ({ setVisible(visible) { modal.current?.setVisible(visible) } }))
  return <Modal ref={modal} transition={alert ? 'alert' : 'sheet'} onHide={onHide} keyHide={keyHide} bgHide={bgHide} bgColor="rgba(0,0,0,0.35)">
    <KeyboardAvoidingView style={[styles.overlay, { justifyContent: alert ? 'center' : 'flex-end' }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} pointerEvents="box-none">
      <SafeAreaView onStartShouldSetResponder={() => true} accessibilityViewIsModal style={[alert ? styles.alert : styles.sheet, { backgroundColor: colors.surface, height }]}>
        {!alert ? <View style={[styles.handle, { backgroundColor: colors.separator }]} /> : null}
        {title || closeBtn ? <View style={[styles.header, alert && styles.alertHeader, !alert && { borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
          <Text size={alert ? 17 : 20} style={[styles.title, alert && { textAlign: 'center' }]} accessibilityRole="header">{title}</Text>
          {closeBtn ? <Pressable onPress={() => { modal.current?.setVisible(false) }} style={styles.close} accessibilityRole="button" accessibilityLabel={t('library_close')}>
            {alert ? <Icon name="close" size={16} color={colors.secondary} /> : <Text size={17} color={colors.accent}>{t('library_done')}</Text>}
          </Pressable> : null}
        </View> : null}
        {children}
      </SafeAreaView>
    </KeyboardAvoidingView>
  </Modal>
})
const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 640, maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  alert: { width: '90%', maxWidth: 400, maxHeight: '82%', borderRadius: 14, overflow: 'hidden' },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 10 },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8, flexShrink: 0 },
  alertHeader: { minHeight: 52, paddingHorizontal: 20 },
  title: { flex: 1, fontWeight: '600', paddingVertical: 12 },
  close: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
})
