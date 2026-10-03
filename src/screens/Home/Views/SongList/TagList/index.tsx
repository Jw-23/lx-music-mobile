import { useEffect, useRef } from 'react'
import { type Source } from '@/store/songlist/state'
import List, { type ListProps, type ListType } from './List'

export default ({ source, activeId }: { source: Source, activeId: string }) => {
  const listRef = useRef<ListType>(null)
  useEffect(() => { listRef.current?.loadTag(source, activeId) }, [source, activeId])
  const handleTagChange: ListProps['onTagChange'] = (name, id) => {
    global.app_event.hideSonglistTagList()
    requestAnimationFrame(() => { global.app_event.songlistTagInfoChange(name, id) })
  }
  return <List ref={listRef} onTagChange={handleTagChange} />
}
