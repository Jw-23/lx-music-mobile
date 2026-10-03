import { SafeAreaView, StyleSheet, View } from 'react-native'
import { useDesignColors } from '@/theme/design'

export default ({ children }: { children: React.ReactNode }) => {
  const colors = useDesignColors()
  return <SafeAreaView style={styles.overlay}>
    <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
      <View style={styles.handleArea}><View style={[styles.handle, { backgroundColor: colors.secondary }]} /></View>
      {children}
    </View>
  </SafeAreaView>
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { width: '100%', maxWidth: 640, maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handleArea: { height: 24, alignItems: 'center', justifyContent: 'center' },
  handle: { height: 5, width: 36, borderRadius: 3, opacity: 0.4 },
})
