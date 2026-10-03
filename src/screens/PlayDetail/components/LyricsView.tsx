import { memo, useEffect, useRef } from 'react'
import { View, FlatList, Pressable, Animated, type LayoutChangeEvent } from 'react-native'
import { type Line, useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import Text from '@/components/common/Text'
import { setSpText } from '@/utils/pixelRatio'
import { useI18n } from '@/lang'
import { formatPlayTime2 } from '@/utils/common'
import PlayLine from './PlayLine'
import { useLyricScroll } from './useLyricScroll'

interface LineProps {
  line: Line
  lineNum: number
  activeLine: number
  orientation: 'vertical' | 'horizontal'
  reduceMotion: boolean
  onSeek: (index: number) => void
  onLayout: (lineNum: number, height: number) => void
}
const LrcLine = memo(({ line, lineNum, activeLine, onLayout, orientation, reduceMotion, onSeek }: LineProps) => {
  const theme = useTheme()
  const t = useI18n()
  const lrcFontSize = useSettingValue(`playDetail.${orientation}.style.lrcFontSize`)
  const textAlign = useSettingValue('playDetail.style.align')
  const size = lrcFontSize / 10
  const lineHeight = setSpText(size) * 1.3
  const active = activeLine === lineNum
  const scale = useRef(new Animated.Value(active ? 1.025 : 1)).current
  const opacity = useRef(new Animated.Value(active ? 1 : 0.52)).current
  const seekable = Number.isFinite(line.time) && line.time >= 0

  useEffect(() => {
    if (reduceMotion) {
      scale.setValue(1)
      opacity.setValue(active ? 1 : 0.52)
      return
    }
    // Both focus animations stay on the native thread while the list scrolls.
    const animation = Animated.parallel([
      Animated.spring(scale, { toValue: active ? 1.025 : 1, stiffness: 220, damping: 26, mass: 0.75, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: active ? 1 : 0.52, duration: 220, useNativeDriver: true }),
    ])
    animation.start()
    return () => { animation.stop() }
  }, [active, reduceMotion, scale, opacity])

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    onLayout(lineNum, nativeEvent.layout.height)
  }
  return <Pressable onLayout={handleLayout} onPress={() => { onSeek(lineNum) }} disabled={!seekable} accessibilityRole="button" accessibilityLabel={seekable ? `${line.text}, ${formatPlayTime2(line.time / 1000)}` : line.text} accessibilityHint={t('library_lyric_seek_hint')} accessibilityState={{ selected: active, disabled: !seekable }} style={({ pressed }) => [styles.line, { opacity: pressed ? 0.75 : 1 }]}>
    <Animated.View style={{ opacity, transform: [{ scale }] }} pointerEvents="none">
      <Text style={{ textAlign, lineHeight, fontWeight: '600' }} textBreakStrategy="simple" color={active ? theme['c-primary'] : theme['c-350']} size={size}>{line.text}</Text>
      {line.extendedLyrics.map((lrc, index) => <Text key={index} style={{ textAlign, lineHeight: lineHeight * 0.8, paddingTop: 5 }} textBreakStrategy="simple" color={active ? theme['c-primary'] : theme['c-300']} size={size * 0.8}>{lrc}</Text>)}
    </Animated.View>
  </Pressable>
}, (prev, next) => prev.orientation === next.orientation && prev.line === next.line && prev.reduceMotion === next.reduceMotion && prev.onSeek === next.onSeek && prev.activeLine !== next.lineNum && next.activeLine !== next.lineNum)

export default ({ orientation }: { orientation: 'vertical' | 'horizontal' }) => {
  const lines = useLrcSet()
  const { line } = useLrcPlay()
  const showProgress = useSettingValue('playDetail.isShowLyricProgressSetting')
  const scroll = useLyricScroll(lines, line, showProgress)
  return <>
    <FlatList
      ref={scroll.flatListRef}
      data={lines}
      extraData={line}
      renderItem={({ item, index }) => <LrcLine line={item} lineNum={index} activeLine={line} onLayout={scroll.onLineLayout} orientation={orientation} reduceMotion={scroll.reduceMotion} onSeek={scroll.onSeekLine} />}
      keyExtractor={(item, index) => `${index}${item.text}`}
      style={styles.container}
      showsVerticalScrollIndicator={false}
      bounces
      overScrollMode="always"
      decelerationRate="normal"
      removeClippedSubviews={false}
      ListHeaderComponent={<View style={{ height: scroll.spaceHeight }} />}
      ListFooterComponent={<View style={{ height: scroll.spaceHeight * 1.4 }} />}
      initialNumToRender={20}
      maxToRenderPerBatch={12}
      {...scroll.scrollProps}
    />
    {showProgress ? <PlayLine ref={scroll.playLineRef} onPlayLine={scroll.onPlayLine} /> : null}
  </>
}

const styles = createStyle({
  container: { flex: 1, paddingHorizontal: 20 },
  line: { minHeight: 44, justifyContent: 'center', paddingVertical: 12 },
})
