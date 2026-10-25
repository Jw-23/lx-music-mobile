import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { View } from 'react-native'
import PagerView, { type PageScrollStateChangedNativeEvent, type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import Search from '../Views/Search'
import SongList from '../Views/SongList'
import Mylist from '../Views/Mylist'
import Leaderboard from '../Views/Leaderboard'
import Setting from '../Views/Setting'
import TVSettings from '../../TV/Settings'
import commonState from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import { setNavActiveId } from '@/core/common'
import settingState from '@/store/setting/state'
import PageTransition from '@/components/common/PageTransition'
import useReducedMotion from '@/utils/hooks/useReducedMotion'
import HomePageHeader from '../HomePageHeader'
import TVFocusScope from '@/components/common/TVFocusScope'
import useTVMode from '@/utils/hooks/useTVMode'
import { useNavActiveId } from '@/store/common/hook'
import { HomePagerScrollContext } from '../pagerScroll'
import { HOME_TAB_IDS as HOME_PAGE_IDS, HOME_TAB_INDEX as homePageIndex, isHomePageNearby, type HomeTabId } from '@/config/homeTabs'

const hideKeys = ['list.isShowAlbumName', 'list.isShowInterval', 'theme.fontShadow'] as Readonly<Array<keyof LX.AppSetting>>
const screens = { nav_love: Mylist, nav_songlist: SongList, nav_top: Leaderboard, nav_search: Search, nav_setting: Setting }
const HomePage = ({ id }: { id: HomeTabId }) => {
  const [visible, setVisible] = useState(isHomePageNearby(commonState.navActiveId, id))
  const Screen = screens[id]
  useEffect(() => {
    const update = (active: HomeTabId) => { if (isHomePageNearby(active, id)) setVisible(true) }
    const invalidate = () => { if (id !== 'nav_setting' && commonState.navActiveId === 'nav_setting') setVisible(false) }
    const configUpdated = (keys: Array<keyof LX.AppSetting>) => { if (keys.some(key => hideKeys.includes(key))) invalidate() }
    global.state_event.on('navActiveIdUpdated', update)
    global.state_event.on('themeUpdated', invalidate)
    global.state_event.on('languageChanged', invalidate)
    global.state_event.on('configUpdated', configUpdated)
    return () => {
      global.state_event.off('navActiveIdUpdated', update)
      global.state_event.off('themeUpdated', invalidate)
      global.state_event.off('languageChanged', invalidate)
      global.state_event.off('configUpdated', configUpdated)
    }
  }, [id])
  // A page's heading moves with its content, so changing tabs never resizes the pager.
  return visible ? <View style={styles.page}><HomePageHeader id={id} /><Screen /></View> : null
}

const TouchMain = () => {
  const [transition, setTransition] = useState({ key: String(commonState.navActiveId), direction: 1, enabled: true })
  const [scrollEnabled, setScrollEnabled] = useState(settingState.setting['common.homePageScroll'])
  const locks = useRef(new Set<HomeTabId>())
  const reduced = useReducedMotion()
  const motion = useRef(reduced)
  motion.current = reduced
  const pager = useRef<ComponentRef<typeof PagerView>>(null)
  const initialPage = useRef(homePageIndex[commonState.navActiveId]).current
  const targetIndex = useRef(initialPage)
  const pendingIndex = useRef<number | null>(null)
  const revision = useRef(0)
  const onPageSelected = useCallback(({ nativeEvent: { position } }: PagerViewOnPageSelectedEvent) => {
    if (!HOME_PAGE_IDS[position]) return
    if (pendingIndex.current !== null && pendingIndex.current !== position) return
    pendingIndex.current = null
    targetIndex.current = position
    if (position !== homePageIndex[commonState.navActiveId]) setNavActiveId(HOME_PAGE_IDS[position])
  }, [])
  const onPageScrollStateChanged = useCallback(({ nativeEvent: { pageScrollState } }: PageScrollStateChangedNativeEvent) => {
    if (pageScrollState === 'dragging') pendingIndex.current = null
    // Native swipes and adjacent-tab slides already animate the complete page.
    if (pageScrollState !== 'idle') setTransition(current => current.enabled ? { ...current, enabled: false } : current)
    global.lx.homePagerIdle = pageScrollState === 'idle'
  }, [])
  const refreshScroll = useCallback(() => {
    const enabled = settingState.setting['common.homePageScroll'] && !locks.current.has(commonState.navActiveId)
    pager.current?.setScrollEnabled(enabled)
    setScrollEnabled(enabled)
  }, [])
  const setLocked = useCallback((id: HomeTabId, locked: boolean) => {
    if (locked) locks.current.add(id)
    else locks.current.delete(id)
    refreshScroll()
  }, [refreshScroll])
  useEffect(() => {
    if (reduced && pendingIndex.current !== null) {
      pager.current?.setPageWithoutAnimation(pendingIndex.current)
      global.lx.homePagerIdle = true
    }
  }, [reduced])
  useEffect(() => {
    const update = (id: HomeTabId) => {
      refreshScroll()
      const index = homePageIndex[id]
      const distance = index - targetIndex.current
      if (!distance) return
      const adjacent = Math.abs(distance) === 1 && !motion.current
      targetIndex.current = index
      pendingIndex.current = index
      global.lx.homePagerIdle = !adjacent
      setTransition({ key: `${id}:${++revision.current}`, direction: Math.sign(distance), enabled: !adjacent })
      if (adjacent) pager.current?.setPage(index)
      else pager.current?.setPageWithoutAnimation(index)
    }
    const configUpdated = (keys: Array<keyof LX.AppSetting>) => {
      if (keys.includes('common.homePageScroll')) refreshScroll()
    }
    global.state_event.on('navActiveIdUpdated', update)
    global.state_event.on('configUpdated', configUpdated)
    return () => {
      global.state_event.off('navActiveIdUpdated', update)
      global.state_event.off('configUpdated', configUpdated)
      global.lx.homePagerIdle = true
    }
  }, [refreshScroll])
  const pages = useMemo(() => HOME_PAGE_IDS.map(id => <View collapsable={false} key={id} style={styles.page}><HomePage id={id} /></View>), [])
  return <PageTransition transitionKey={transition.key} direction={transition.direction} enabled={transition.enabled}>
    <HomePagerScrollContext.Provider value={setLocked}><PagerView ref={pager} initialPage={initialPage} offscreenPageLimit={1} onPageSelected={onPageSelected} onPageScrollStateChanged={onPageScrollStateChanged} scrollEnabled={scrollEnabled} overScrollMode="never" layoutDirection="ltr" style={styles.page}>{pages}</PagerView></HomePagerScrollContext.Provider>
  </PageTransition>
}
const styles = createStyle({ page: { flex: 1, overflow: 'hidden' } })

const TVMain = () => {
  const active = useNavActiveId()
  const visited = useRef(new Set<HomeTabId>())
  visited.current.add(active)
  return <PageTransition transitionKey={active} direction={1}>
    {HOME_PAGE_IDS.filter(id => visited.current.has(id)).map(id => {
      const Screen = id === 'nav_setting' ? TVSettings : screens[id]
      return <TVFocusScope key={id} blocked={id !== active} style={[styles.page, id !== active && { display: 'none' }]}>
        <HomePageHeader id={id} /><Screen />
      </TVFocusScope>
    })}
  </PageTransition>
}
export default () => useTVMode() ? <TVMain /> : <TouchMain />
