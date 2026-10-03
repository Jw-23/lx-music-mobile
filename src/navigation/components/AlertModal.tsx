import { useEffect, useRef } from 'react'
import { BackHandler, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { Navigation } from 'react-native-navigation'
import Text from '@/components/common/Text'
import { useDesignColors } from '@/theme/design'
import { type AlertRequest } from '../alerts'

export default ({ componentId, request, onResult }: { componentId: string, request: AlertRequest, onResult: (value: number) => void }) => {
  const colors = useDesignColors()
  const { height } = useWindowDimensions()
  const settled = useRef(false)
  const dismiss = async(value: number) => {
    if (settled.current) return
    settled.current = true
    try { await Navigation.dismissOverlay(componentId) } finally { onResult(value) }
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (request.cancelable) void dismiss(-1)
      return true
    })
    return () => {
      subscription.remove()
      if (!settled.current) { settled.current = true; onResult(-1) }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <View style={styles.overlay}>
    <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (request.cancelable) void dismiss(-1) }} accessibilityLabel="Dismiss" />
    <View style={[styles.alert, { backgroundColor: colors.surface, maxHeight: height * 0.8 }]}>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={styles.content}>
        {request.title ? <Text size={17} style={styles.title}>{request.title}</Text> : null}
        {request.message ? <Text size={15} style={styles.message}>{request.message}</Text> : null}
      </ScrollView>
      <View style={{ flexDirection: request.buttons.length > 2 ? 'column' : 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }}>
        {request.buttons.map((button, index) => <Pressable key={index} accessibilityRole="button" onPress={() => { void dismiss(button.value) }} style={({ pressed }) => [styles.button, request.buttons.length <= 2 && { flex: 1 }, { borderColor: colors.separator, borderLeftWidth: index && request.buttons.length === 2 ? StyleSheet.hairlineWidth : 0, borderTopWidth: index && request.buttons.length > 2 ? StyleSheet.hairlineWidth : 0, backgroundColor: pressed ? colors.secondarySurface : colors.surface }]}><Text size={17} color={button.destructive ? colors.destructive : colors.accent} style={{ fontWeight: button.value === 1 ? '600' : '400', textAlign: 'center' }}>{button.text}</Text></Pressable>)}
      </View>
    </View>
  </View>
}
const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', padding: 32 },
  alert: { width: '100%', maxWidth: 400, borderRadius: 14, overflow: 'hidden' },
  content: { padding: 24, gap: 8 },
  title: { textAlign: 'center', fontWeight: '600', lineHeight: 24 },
  message: { textAlign: 'center', lineHeight: 22 },
  button: { minHeight: 50, padding: 12, alignItems: 'center', justifyContent: 'center' },
})
