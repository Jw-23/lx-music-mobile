import { useEffect, useMemo, useRef, useState } from 'react'
import Search from '../Views/Search'
import SongList from '../Views/SongList'
import Mylist from '../Views/Mylist'
import Leaderboard from '../Views/Leaderboard'
import Setting from '../Views/Setting'
import PageTransition from '@/components/common/PageTransition'
import { HOME_PAGE_IDS } from '../navigationModel'
import HomePageHeader from '../HomePageHeader'
import { View } from 'react-native'
import commonState from '@/store/common/state'


const Main = () => {
  const [id, setId] = useState(commonState.navActiveId)

  const previous = useRef(id)
  const direction = useRef(1)
  const order = HOME_PAGE_IDS
  if (previous.current !== id) { direction.current = order.indexOf(id) > order.indexOf(previous.current) ? 1 : -1; previous.current = id }

  useEffect(() => {
    const handleUpdate = (id: typeof commonState.navActiveId) => {
      setId(id)
    }
    global.state_event.on('navActiveIdUpdated', handleUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleUpdate)
    }
  }, [])

  const component = useMemo(() => {
    switch (id) {
      case 'nav_songlist': return <SongList />
      case 'nav_top': return <Leaderboard />
      case 'nav_love': return <Mylist />
      case 'nav_setting': return <Setting />
      case 'nav_search':
      default: return <Search />
    }
  }, [id])

  return <PageTransition transitionKey={id} direction={direction.current}><View style={{ flex: 1 }}><HomePageHeader id={id} />{component}</View></PageTransition>
}


export default Main

