import { memo, useState, useRef, useEffect } from 'react'
import { View, AppState, Pressable } from 'react-native'

import Header from './components/Header'
// import Aside from './components/Aside'
// import Main from './components/Main'
import Player from './Player'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import Pic from './Pic'
import Lyric from './Lyric'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import { useDesignColors } from '@/theme/design'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'

// global.iskeep = false
export default memo(({ componentId }: { componentId: string }) => {
  const colors = useDesignColors()
  const t = useI18n()
  const pager = useRef<PagerView>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const showLyricRef = useRef(false)

  const onPageSelected = ({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    setPageIndex(nativeEvent.position)
    showLyricRef.current = nativeEvent.position == 1
    if (showLyricRef.current) {
      screenkeepAwake()
    } else {
      screenUnkeepAwake()
    }
  }

  useEffect(() => {
    let appstateListener = AppState.addEventListener('change', (state) => {
      switch (state) {
        case 'active':
          if (showLyricRef.current && !commonState.componentIds.comment) screenkeepAwake()
          break
        case 'background':
          screenUnkeepAwake()
          break
      }
    })

    const handleComponentIdsChange = (ids: CommonState['componentIds']) => {
      if (ids.comment) screenUnkeepAwake()
      else if (showLyricRef.current && AppState.currentState == 'active') screenkeepAwake()
    }

    global.state_event.on('componentIdsUpdated', handleComponentIdsChange)

    return () => {
      global.state_event.off('componentIdsUpdated', handleComponentIdsChange)
      appstateListener.remove()
      screenUnkeepAwake()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Header />
      <View style={styles.container}>
        <PagerView
          ref={pager}
          offscreenPageLimit={1}
          overdrag
          onPageSelected={onPageSelected}
          // onPageScrollStateChanged={onPageScrollStateChanged}
          style={styles.pagerView}
        >
          <View collapsable={false}>
            <Pic componentId={componentId} />
          </View>
          <View collapsable={false}>
            <Lyric />
          </View>
        </PagerView>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          {(['library_cover', 'library_lyrics'] as const).map((label, index) => <Pressable key={label} accessibilityRole="tab" accessibilityLabel={t(label)} accessibilityState={{ selected: pageIndex === index }} onPress={() => { pager.current?.setPage(index) }} style={{ minHeight: 44, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 12, backgroundColor: pageIndex === index ? colors.secondarySurface : 'transparent' }}><Text size={13} color={pageIndex === index ? colors.accent : colors.secondary}>{t(label)}</Text></Pressable>)}
        </View>
        <Player />
      </View>
    </>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  pagerView: {
    flex: 1,
  },
  // pageIndicator: {
  //   flex: 0,
  //   flexDirection: 'row',
  //   justifyContent: 'center',
  //   paddingTop: 10,
  //   // backgroundColor: 'rgba(0,0,0,0.1)',
  // },
  // pageIndicatorItem: {
  //   height: 3,
  //   width: '5%',
  //   marginLeft: 2,
  //   marginRight: 2,
  //   borderRadius: 2,
  // },
})
