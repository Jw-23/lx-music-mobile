import { KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, StyleSheet, View } from 'react-native'
import Text from './Text'
import { useDesignColors, design } from '@/theme/design'
import { useI18n } from '@/lang'

export default ({ visible, title, onClose, children }: {
  visible: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) => {
  const colors = useDesignColors()
  const t = useI18n()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS == 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('library_close')} />
        <SafeAreaView style={[styles.sheet, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
          <View style={[styles.handle, { backgroundColor: colors.separator }]} />
          <View style={[styles.header, { borderBottomColor: colors.separator }]}>
            <Text size={20} style={styles.title} accessibilityRole="header">{title}</Text>
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel={t('library_close')}>
              <Text size={17} color={colors.accent}>{t('library_done')}</Text>
            </Pressable>
          </View>
          {children}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { width: '100%', maxWidth: 640, maxHeight: '88%', borderTopLeftRadius: design.radius.sheet, borderTopRightRadius: design.radius.sheet, overflow: 'hidden' },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8, minHeight: 60, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, fontWeight: '600' },
  close: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
})
