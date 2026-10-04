import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, Modal, Pressable, StyleSheet, type ModalProps } from 'react-native'
import useReducedMotion from '@/utils/hooks/useReducedMotion'
import { createModalTransition } from './modalTransition'

export type ModalTransition = 'sheet' | 'alert' | 'popover'
interface Props extends Omit<ModalProps, 'visible' | 'animationType'> {
  visible: boolean
  onHidden?: () => void
  onBackgroundPress?: () => void
  backgroundLabel?: string
  backgroundColor?: string
  transition?: ModalTransition
}

export default ({ visible, onHidden, onBackgroundPress, backgroundLabel, backgroundColor = 'rgba(0,0,0,0.35)', transition = 'sheet', children, onShow, ...props }: Props) => {
  const reduced = useReducedMotion()
  const latest = useRef({ reduced, onHidden })
  latest.current = { reduced, onHidden }
  const [presented, setPresented] = useState(false)
  const lastChildren = useRef(children)
  if (visible || !presented) lastChildren.current = children
  const progress = useRef(new Animated.Value(0)).current
  const backdrop = useRef(new Animated.Value(0)).current
  const controller = useMemo(() => createModalTransition({
    present: setPresented,
    hidden: () => { latest.current.onHidden?.() },
    animate(opening, complete) {
      const toValue = opening ? 1 : 0
      if (latest.current.reduced) {
        progress.setValue(toValue)
        backdrop.setValue(toValue)
        complete()
        return () => {}
      }
      const animation = Animated.parallel([
        opening
          ? Animated.spring(progress, { toValue, stiffness: 240, damping: 28, mass: 0.9, overshootClamping: true, useNativeDriver: true })
          : Animated.timing(progress, { toValue, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdrop, { toValue, duration: opening ? 240 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ])
      animation.start(({ finished }) => { if (finished) complete() })
      return () => { animation.stop() }
    },
  }), [progress, backdrop])
  useEffect(() => { controller.setVisible(visible) }, [controller, visible])
  useEffect(() => { controller.refreshMotion() }, [controller, reduced])
  useEffect(() => () => { controller.dispose() }, [controller])

  const interpolate = (from: number, to: number) => progress.interpolate({ inputRange: [0, 1], outputRange: [from, to], extrapolate: 'clamp' })
  const transform = transition === 'sheet'
    ? [{ translateY: interpolate(56, 0) }]
    : transition === 'alert' ? [{ scale: interpolate(0.96, 1) }] : [{ translateY: interpolate(6, 0) }, { scale: interpolate(0.98, 1) }]
  return <Modal {...props} visible={presented} transparent animationType="none" hardwareAccelerated statusBarTranslucent onShow={event => { controller.onShow(); onShow?.(event) }}>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor, opacity: backdrop }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onBackgroundPress} disabled={!onBackgroundPress} accessibilityRole="button" accessibilityLabel={backgroundLabel} />
    </Animated.View>
    <Animated.View style={{ flex: 1, opacity: progress, transform }} pointerEvents={visible ? 'box-none' : 'none'}>
      {lastChildren.current}
    </Animated.View>
  </Modal>
}
