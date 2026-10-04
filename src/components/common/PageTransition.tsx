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
    opacity.setValue(0.88)
    offset.setValue(direction < 0 ? -12 : 12)
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(offset, { toValue: 0, duration: 240, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }),
    ])
    animation.start()
    return () => { animation.stop() }
  }, [transitionKey, direction, enabled, reduced, opacity, offset])
  return <Animated.View style={{ flex: 1, opacity, transform: [{ translateX: offset }] }}>{children}</Animated.View>
}
