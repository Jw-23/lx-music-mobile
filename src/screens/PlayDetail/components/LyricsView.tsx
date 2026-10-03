import { memo, useMemo } from 'react'
import { View, FlatList, type LayoutChangeEvent } from 'react-native'
import { type Line, useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { AnimatedColorText } from '@/components/common/Text'
import { setSpText } from '@/utils/pixelRatio'
import PlayLine from './PlayLine'
import { useLyricScroll } from './useLyricScroll'

interface LineProps {
  line: Line
  lineNum: number
  activeLine: number
  orientation: 'vertical' | 'horizontal'
  onLayout: (lineNum: number, height: number, width: number) => void
}
const LrcLine = memo(({ line, lineNum, activeLine, onLayout, orientation }: LineProps) => {
  const theme = useTheme()
  const lrcFontSize = useSettingValue(`playDetail.${orientation}.style.lrcFontSize`)
  const textAlign = useSettingValue('playDetail.style.align')
  const size = lrcFontSize / 10
  const lineHeight = setSpText(size) * 1.3

  const colors = useMemo(() => {
    const active = activeLine == lineNum
    return active ? [
      theme['c-primary'],
      theme['c-primary-alpha-200'],
      1,
    ] as const : [
      theme['c-350'],
      theme['c-300'],
      0.6,
    ] as const
  }, [activeLine, lineNum, theme])

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    onLayout(lineNum, nativeEvent.layout.height, nativeEvent.layout.width)
  }


  // textBreakStrategy="simple" 用于解决某些设备上字体被截断的问题
  // https://stackoverflow.com/a/72822360
  return (
    <View style={styles.line} onLayout={handleLayout}>
      <AnimatedColorText style={{
        ...styles.lineText,
        textAlign,
        lineHeight,
      }} textBreakStrategy="simple" color={colors[0]} opacity={colors[2]} size={size}>{line.text}</AnimatedColorText>
      {
        line.extendedLyrics.map((lrc, index) => {
          return (<AnimatedColorText style={{
            ...styles.lineTranslationText,
            textAlign,
            lineHeight: lineHeight * 0.8,
          }} textBreakStrategy="simple" key={index} color={colors[1]} opacity={colors[2]} size={size * 0.8}>{lrc}</AnimatedColorText>)
        })
      }
    </View>
  )
}, (prevProps, nextProps) => {
  return prevProps.orientation === nextProps.orientation && prevProps.line === nextProps.line &&
    prevProps.activeLine != nextProps.lineNum &&
    nextProps.activeLine != nextProps.lineNum
})
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
      renderItem={({ item, index }) => <LrcLine line={item} lineNum={index} activeLine={line} onLayout={scroll.onLineLayout} orientation={orientation} />}
      keyExtractor={(item, index) => `${index}${item.text}`}
      style={styles.container}
      showsVerticalScrollIndicator={false}
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
  container: {
    flex: 1,
    paddingLeft: 20,
    paddingRight: 20,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  line: {
    paddingTop: 10,
    paddingBottom: 10,
    // opacity: 0,
  },
  lineText: {
    textAlign: 'center',
    // fontSize: 16,
    // lineHeight: 20,
    // paddingTop: 5,
    // paddingBottom: 5,
    // opacity: 0,
  },
  lineTranslationText: {
    textAlign: 'center',
    // fontSize: 13,
    // lineHeight: 17,
    paddingTop: 5,
    // paddingBottom: 5,
  },
})
