import { useLayoutEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import useReducedMotion from '@/utils/hooks/useReducedMotion'

export default ({ transitionKey, children }: { transitionKey: string, children: React.ReactNode }) => {
  const reduced = useReducedMotion()
  const previous = useRef(transitionKey)
  const opacity = useRef(new Animated.Value(1)).current
  const offset = useRef(new Animated.Value(0)).current
  useLayoutEffect(() => {
    const changed = previous.current !== transitionKey
    previous.current = transitionKey
    opacity.setValue(1)
    offset.setValue(0)
    if (!changed || reduced) return
    opacity.setValue(0.65)
    offset.setValue(6)
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(offset, { toValue: 0, stiffness: 260, damping: 30, mass: 0.8, useNativeDriver: true }),
    ])
    animation.start()
    return () => { animation.stop() }
  }, [transitionKey, reduced, opacity, offset])
  return <Animated.View style={{ flex: 1, opacity, transform: [{ translateY: offset }] }}>{children}</Animated.View>
}
