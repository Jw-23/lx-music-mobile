import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, Modal, Pressable, StyleSheet, type ModalProps } from 'react-native'
import useReducedMotion from '@/utils/hooks/useReducedMotion'
import useTVMode from '@/utils/hooks/useTVMode'
import TVFocusScope from './TVFocusScope'
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
  const tv = useTVMode()
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
          ? Animated.spring(progress, { toValue, stiffness: 240, damping: 30, mass: 1, overshootClamping: true, useNativeDriver: true })
          : Animated.timing(progress, { toValue, duration: 230, easing: Easing.bezier(0.4, 0, 1, 1), useNativeDriver: true }),
        Animated.timing(backdrop, { toValue, duration: opening ? 280 : 230, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
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
    ? [{ translateY: interpolate(88, 0) }]
    : transition === 'alert' ? [{ scale: interpolate(0.96, 1) }] : [{ translateY: interpolate(10, 0) }, { scale: interpolate(0.98, 1) }]
  // Sheets settle spatially; their text reaches full opacity early in the entrance.
  const contentOpacity = transition === 'sheet' ? progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }) : progress
  return <Modal {...props} visible={presented} transparent animationType="none" hardwareAccelerated statusBarTranslucent onShow={event => { controller.onShow(); onShow?.(event) }}>
    <TVFocusScope autoFocus blocked={!visible} style={{ flex: 1 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor, opacity: backdrop }]}>
        <Pressable focusable={tv ? false : undefined} style={StyleSheet.absoluteFill} onPress={onBackgroundPress} disabled={!onBackgroundPress} accessibilityRole="button" accessibilityLabel={backgroundLabel} />
      </Animated.View>
      <Animated.View style={{ flex: 1, opacity: contentOpacity, transform }} pointerEvents={visible ? 'box-none' : 'none'}>
        {lastChildren.current}
      </Animated.View>
    </TVFocusScope>
  </Modal>
}
