import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, View } from 'react-native'
import Text from './Text'
import AnimatedModal from './AnimatedModal'
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
    <AnimatedModal visible={visible} onRequestClose={onClose} onBackgroundPress={onClose} backgroundLabel={t('library_close')}>
      <KeyboardAvoidingView style={styles.overlay} pointerEvents="box-none" behavior={Platform.OS == 'ios' ? 'padding' : 'height'}>
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
    </AnimatedModal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 640, maxHeight: '88%', borderTopLeftRadius: design.radius.sheet, borderTopRightRadius: design.radius.sheet, overflow: 'hidden' },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8, minHeight: 60, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, minWidth: 0, fontWeight: '600' },
  close: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
})
