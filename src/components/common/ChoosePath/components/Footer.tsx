import { memo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Text from '@/components/common/Text'
import { useDesignColors } from '@/theme/design'
import { useI18n } from '@/lang'
export default memo(({ onConfirm, onHide, dirOnly }: { onConfirm: () => void, onHide: () => void, dirOnly: boolean }) => {
  const colors = useDesignColors()
  const t = useI18n()
  return <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.separator }]}>
    <Pressable style={styles.button} onPress={onHide} accessibilityRole="button"><Text size={17} color={colors.accent}>{t('cancel')}</Text></Pressable>
    {dirOnly ? <Pressable style={[styles.button, { borderRadius: 12, backgroundColor: colors.accent }]} onPress={onConfirm} accessibilityRole="button"><Text size={17} color="#FFFFFF" style={{ fontWeight: '600' }}>{t('confirm')}</Text></Pressable> : null}
  </View>
})
const styles = StyleSheet.create({
  footer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 16, borderTopWidth: StyleSheet.hairlineWidth },
  button: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
})
