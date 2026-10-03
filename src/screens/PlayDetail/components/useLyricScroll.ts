import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, type FlatList, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { type Line } from '@/plugins/lyric'
import { type PlayLineType } from './PlayLine'

export const useLyricScroll = (lines: Line[], activeLine: number, showProgress: boolean) => {
  const flatListRef = useRef<FlatList<Line>>(null)
  const playLineRef = useRef<PlayLineType>(null)
  const paused = useRef(false)
  const dragging = useRef(false)
  const momentum = useRef(false)
  const active = useRef(activeLine)
  active.current = activeLine
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retries = useRef(0)
  const reducedMotion = useRef(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const scrollInfo = useRef<NativeScrollEvent | null>(null)
  const layout = useRef({ spaceHeight: 0, lineHeights: [] as number[] })
  const [height, setHeight] = useState(0)
  const cancelResume = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    resumeTimer.current = null
  }, [])
  const cancelRetry = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current)
    retryTimer.current = null
  }, [])
  const follow = useCallback((animated = true) => {
    if (paused.current || dragging.current || momentum.current || active.current < 0 || active.current >= lines.length) return
    flatListRef.current?.scrollToIndex({ index: active.current, viewPosition: 0.42, animated: animated && !reducedMotion.current })
  }, [lines.length])
  const resume = useCallback(() => {
    cancelResume()
    resumeTimer.current = setTimeout(() => {
      resumeTimer.current = null
      if (dragging.current || momentum.current) return
      paused.current = false
      playLineRef.current?.setVisible(false)
      retries.current = 0
      follow()
    }, 2500)
  }, [cancelResume, follow])

  useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) { reducedMotion.current = value; setReduceMotion(value) } })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reducedMotion.current = value; setReduceMotion(value) })
    return () => { mounted = false; subscription.remove(); cancelResume(); cancelRetry() }
  }, [cancelResume, cancelRetry])

  useEffect(() => {
    cancelResume()
    cancelRetry()
    paused.current = false
    dragging.current = false
    momentum.current = false
    retries.current = 0
    layout.current.lineHeights = []
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false })
    playLineRef.current?.setVisible(false)
    playLineRef.current?.updateLyricLines(lines)
    const frame = requestAnimationFrame(() => { follow(false) })
    return () => { cancelAnimationFrame(frame); cancelRetry() }
  }, [lines, follow, cancelResume, cancelRetry])

  useEffect(() => {
    cancelRetry()
    retries.current = 0
    // Native scroll animation starts with the lyric change, without a 600 ms delay.
    follow()
  }, [activeLine, height, follow, cancelRetry])

  useEffect(() => {
    playLineRef.current?.updateLayoutInfo(layout.current)
    playLineRef.current?.updateLyricLines(lines)
  }, [showProgress, lines])

  const onLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    const height = nativeEvent.layout.height
    layout.current.spaceHeight = height * 0.42
    setHeight(height)
    playLineRef.current?.updateLayoutInfo(layout.current)
  }, [])
  const onLineLayout = useCallback((index: number, height: number) => {
    layout.current.lineHeights[index] = height
    playLineRef.current?.updateLayoutInfo(layout.current)
  }, [])
  const onScroll = useCallback(({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollInfo.current = nativeEvent
    if (paused.current) playLineRef.current?.updateScrollInfo(nativeEvent)
  }, [])
  const onScrollBeginDrag = useCallback(() => {
    paused.current = true
    dragging.current = true
    momentum.current = false
    cancelResume()
    cancelRetry()
    // Interrupt an in-flight native follow animation when the user takes control.
    if (scrollInfo.current) flatListRef.current?.scrollToOffset({ offset: scrollInfo.current.contentOffset.y, animated: false })
    playLineRef.current?.setVisible(true)
  }, [cancelResume, cancelRetry])
  const onMomentumScrollBegin = useCallback(() => {
    if (!paused.current) return
    momentum.current = true
    cancelResume()
  }, [cancelResume])
  const onScrollToIndexFailed = useCallback((info: { index: number, averageItemLength: number }) => {
    if (paused.current || dragging.current || momentum.current || info.index !== active.current || retries.current >= 2) return
    ++retries.current
    flatListRef.current?.scrollToOffset({ offset: Math.max(0, info.averageItemLength * info.index), animated: false })
    cancelRetry()
    retryTimer.current = setTimeout(() => { retryTimer.current = null; follow(false) }, 120)
  }, [follow, cancelRetry])
  const onPlayLine = useCallback((time: number) => {
    if (!Number.isFinite(time) || time < 0 || dragging.current || momentum.current) return
    cancelResume()
    cancelRetry()
    paused.current = false
    playLineRef.current?.setVisible(false)
    global.app_event.setProgress(time)
  }, [cancelResume, cancelRetry])
  const onSeekLine = useCallback((index: number) => {
    const time = lines[index]?.time
    if (!Number.isFinite(time) || time < 0 || dragging.current || momentum.current) return
    onPlayLine(time / 1000)
  }, [lines, onPlayLine])
  return {
    flatListRef,
    playLineRef,
    onLineLayout,
    onPlayLine,
    onSeekLine,
    reduceMotion,
    spaceHeight: height * 0.42,
    scrollProps: {
      onLayout,
      onScroll,
      onScrollBeginDrag,
      onScrollEndDrag: () => { dragging.current = false; if (paused.current && !momentum.current) resume() },
      onMomentumScrollBegin,
      onMomentumScrollEnd: () => { momentum.current = false; if (paused.current && !dragging.current) resume() },
      onScrollToIndexFailed,
      scrollEventThrottle: 16,
    },
  }
}
