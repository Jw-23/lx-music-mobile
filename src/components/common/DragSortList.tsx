import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, FlatList, PanResponder, StyleSheet, View, type GestureResponderHandlers, type ViewProps } from 'react-native'
import useReducedMotion from '@/utils/hooks/useReducedMotion'
import { getDragIndex, getDragScroll, getDragShift } from './dragSort'

interface DragState<T> {
  item: T
  from: number
  to: number
  min: number
  max: number
  startOffset: number
  dy: number
  fingerY: number
  revision: string
}
type DragHandle = GestureResponderHandlers & Pick<ViewProps, 'accessibilityRole' | 'accessibilityActions' | 'onAccessibilityAction'>

interface Props<T> {
  data: T[]
  rowHeight: number
  revisionKey: string
  keyExtractor: (item: T) => string
  renderRow: (item: T, dragging: boolean, handle: DragHandle) => React.ReactNode
  onMove: (from: number, to: number) => void
  getRange: (index: number) => [number, number]
  empty: React.ReactElement
}

const SortRow = ({ height, shift, hidden, reduced, children }: {
  height: number
  shift: number
  hidden: boolean
  reduced: boolean
  children: React.ReactNode
}) => {
  const translate = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) { translate.setValue(shift); return }
    const animation = Animated.spring(translate, { toValue: shift, stiffness: 280, damping: 30, mass: 0.8, useNativeDriver: true })
    animation.start()
    return () => { animation.stop() }
  }, [shift, reduced, translate])
  return <Animated.View pointerEvents={hidden ? 'none' : 'auto'} style={{ height, opacity: hidden ? 0 : 1, transform: [{ translateY: translate }] }}>{children}</Animated.View>
}

/** Virtualized list with a floating drag row and edge scrolling. */
export default function DragSortList<T>(props: Props<T>) {
  const { data, rowHeight, revisionKey, keyExtractor, renderRow, empty } = props
  const latest = useRef(props)
  latest.current = props
  const reduced = useReducedMotion()
  const list = useRef<FlatList<T>>(null)
  const viewport = useRef<View>(null)
  const bounds = useRef({ top: 0, height: 0, offset: 0, ready: false })
  const active = useRef<DragState<T> | null>(null)
  const armed = useRef<number | null>(null)
  const frame = useRef<number | null>(null)
  const dragTop = useRef(new Animated.Value(0)).current
  const [drag, setDrag] = useState<DragState<T> | null>(null)
  const finish = (commit: boolean) => {
    if (frame.current != null) cancelAnimationFrame(frame.current)
    frame.current = null
    const state = active.current
    active.current = null
    armed.current = null
    setDrag(null)
    if (commit && state && state.revision === latest.current.revisionKey && state.from !== state.to) latest.current.onMove(state.from, state.to)
  }
  useEffect(() => { finish(false) }, [revisionKey, rowHeight]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    active.current = null
    if (frame.current != null) cancelAnimationFrame(frame.current)
  }, [])
  const update = () => {
    const state = active.current
    if (!state) return
    const top = state.from * latest.current.rowHeight - state.startOffset + state.dy
    dragTop.setValue(top)
    const to = getDragIndex(top, bounds.current.offset, latest.current.rowHeight, state.min, state.max)
    if (to !== state.to) { state.to = to; setDrag({ ...state }) }
  }
  const tick = () => {
    frame.current = null
    const state = active.current
    if (!state) return
    const { height, offset, top } = bounds.current
    const next = !bounds.current.ready ? offset : getDragScroll(state.fingerY - top, height, offset, latest.current.data.length * latest.current.rowHeight)
    if (next !== offset) {
      bounds.current.offset = next
      list.current?.scrollToOffset({ offset: next, animated: false })
      update()
    }
    frame.current = requestAnimationFrame(tick)
  }
  const start = (index: number, y: number) => {
    finish(false)
    const item = latest.current.data[index]
    if (!item) return
    const [min, max] = latest.current.getRange(index)
    if (!item || min === max) return
    const state = { item, from: index, to: index, min, max, startOffset: bounds.current.offset, dy: 0, fingerY: y, revision: latest.current.revisionKey }
    active.current = state
    bounds.current.ready = false
    dragTop.setValue(index * latest.current.rowHeight - bounds.current.offset)
    setDrag({ ...state })
    viewport.current?.measureInWindow((_x, top, _width, height) => {
      if (active.current === state) Object.assign(bounds.current, { top, height, ready: true })
    })
    frame.current = requestAnimationFrame(tick)
  }
  const move = (dy: number, y: number) => {
    if (!active.current) return
    active.current.dy = dy
    active.current.fingerY = y
    update()
  }
  // The viewport owns the gesture, so virtualization can recycle the source
  // row during a long drag without losing the touch stream.
  const gestureCallbacks = useRef({ start, move, finish })
  gestureCallbacks.current = { start, move, finish }
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => armed.current != null,
    onPanResponderGrant: (_event, gesture) => {
      if (armed.current != null) gestureCallbacks.current.start(armed.current, gesture.y0)
    },
    onPanResponderMove: (_event, gesture) => { gestureCallbacks.current.move(gesture.dy, gesture.moveY) },
    onPanResponderRelease: () => { gestureCallbacks.current.finish(true) },
    onPanResponderTerminate: () => { gestureCallbacks.current.finish(false) },
    onPanResponderTerminationRequest: () => false,
  }), [])
  return <View {...responder.panHandlers} ref={viewport} style={styles.viewport} onLayout={event => { if (active.current) finish(false); bounds.current.height = event.nativeEvent.layout.height }}>
    <FlatList ref={list} data={data} keyExtractor={keyExtractor} extraData={drag} scrollEnabled={!drag}
      removeClippedSubviews={false} scrollEventThrottle={16}
      getItemLayout={(_data, index) => ({ length: rowHeight, offset: rowHeight * index, index })}
      onScroll={event => { bounds.current.offset = event.nativeEvent.contentOffset.y; update() }}
      ListEmptyComponent={empty}
      renderItem={({ item, index }) => <SortRow height={rowHeight} shift={drag ? getDragShift(index, drag.from, drag.to, rowHeight) : 0} hidden={drag?.from === index} reduced={reduced}>{renderRow(item, false, {
        onStartShouldSetResponder: () => {
          const [min, max] = latest.current.getRange(index)
          if (min < max) armed.current = index
          return false
        },
        accessibilityRole: 'adjustable',
        accessibilityActions: [{ name: 'increment' }, { name: 'decrement' }],
        onAccessibilityAction: event => {
          const [min, max] = latest.current.getRange(index)
          const to = event.nativeEvent.actionName === 'increment' ? index + 1 : index - 1
          if (to >= min && to <= max) latest.current.onMove(index, to)
        },
      })}</SortRow>}
    />
    {drag ? <Animated.View pointerEvents="none" style={[styles.floating, { height: rowHeight, transform: [{ translateY: dragTop }] }]}>{renderRow(drag.item, true, {})}</Animated.View> : null}
  </View>
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  floating: { position: 'absolute', left: 8, right: 8, top: 0, borderRadius: 12, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
})
