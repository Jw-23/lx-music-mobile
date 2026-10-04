import { useLayoutEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native'
import useReducedMotion from '@/utils/hooks/useReducedMotion'
import { useDesignColors } from '@/theme/design'

// Retain both levels through a pop so the settings list keeps its scroll position.
export default ({ detailKey, detail, children }: {
  detailKey?: string
  detail: React.ReactNode
  children: React.ReactNode
}) => {
  const reduced = useReducedMotion()
  const colors = useDesignColors()
  const { width } = useWindowDimensions()
  const [presented, setPresented] = useState(!!detailKey)
  const lastDetail = useRef(detail)
  if (detailKey) lastDetail.current = detail
  const progress = useRef(new Animated.Value(detailKey ? 1 : 0)).current
  useLayoutEffect(() => {
    let valid = true
    const visible = !!detailKey
    if (visible) setPresented(true)
    const finish = () => { if (valid && !visible) setPresented(false) }
    if (reduced) {
      progress.setValue(visible ? 1 : 0)
      finish()
      return
    }
    const animation = Animated.timing(progress, { toValue: visible ? 1 : 0, duration: visible ? 320 : 280, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true })
    animation.start(({ finished }) => { if (finished) finish() })
    return () => { valid = false; animation.stop() }
  }, [detailKey, reduced, progress])
  const interpolate = (from: number, to: number) => progress.interpolate({ inputRange: [0, 1], outputRange: [from, to], extrapolate: 'clamp' })
  return <View style={styles.container}>
    <Animated.View pointerEvents={presented ? 'none' : 'auto'} accessibilityElementsHidden={presented} importantForAccessibility={presented ? 'no-hide-descendants' : 'auto'} style={[styles.container, { opacity: interpolate(1, 0.92), transform: [{ translateX: interpolate(0, -Math.min(width * 0.2, 64)) }] }]}>{children}</Animated.View>
    {presented ? <Animated.View pointerEvents={detailKey ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, transform: [{ translateX: interpolate(width, 0) }] }]}>{lastDetail.current}</Animated.View> : null}
  </View>
}
const styles = StyleSheet.create({ container: { flex: 1, overflow: 'hidden' } })
