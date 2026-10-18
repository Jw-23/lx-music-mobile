import { useLayoutEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import useReducedMotion from '@/utils/hooks/useReducedMotion'

// Tab taps use a short, directional reveal. Native pager swipes keep their own motion.
export default ({ transitionKey, direction = 1, enabled = true, children }: {
  transitionKey: string
  direction?: number
  enabled?: boolean
  children: React.ReactNode
}) => {
  const reduced = useReducedMotion()
  const previous = useRef(transitionKey)
  const opacity = useRef(new Animated.Value(1)).current
  const offset = useRef(new Animated.Value(0)).current
  useLayoutEffect(() => {
    const changed = previous.current !== transitionKey
    previous.current = transitionKey
    opacity.setValue(1)
    offset.setValue(0)
    if (!changed || reduced || !enabled) return
    opacity.setValue(0.94)
    offset.setValue(direction < 0 ? -20 : 20)
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(offset, { toValue: 0, stiffness: 280, damping: 30, mass: 0.9, overshootClamping: true, useNativeDriver: true }),
    ])
    animation.start()
    return () => { animation.stop() }
  }, [transitionKey, direction, enabled, reduced, opacity, offset])
  return <Animated.View style={{ flex: 1, opacity, transform: [{ translateX: offset }] }}>{children}</Animated.View>
}
