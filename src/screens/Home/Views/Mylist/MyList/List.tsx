import { useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { useActiveListId, useMyList } from '@/store/list/hook'
import { getListMusics, setActiveList } from '@/core/list'
import { useDesignColors } from '@/theme/design'
import { useI18n } from '@/lang'
import { type Position } from './ListMenu'

export default ({ onShowMenu, onCreate }: {
  onCreate: () => void
  onShowMenu: (info: { listInfo: LX.List.MyListInfo, index: number }, position: Position) => void
}) => {
  const lists = useMyList()
  const activeId = useActiveListId()
  const colors = useDesignColors()
  const t = useI18n()
  const [query, setQuery] = useState('')
  const [musics, setMusics] = useState<Record<string, LX.Music.MusicInfo[]>>({})
  useEffect(() => {
    let disposed = false
    let revision = 0
    const refresh = () => {
      const version = ++revision
      void Promise.all(lists.map(async(list) => [list.id, [...await getListMusics(list.id)]] as [string, LX.Music.MusicInfo[]])).then(data => {
        if (!disposed && version === revision) setMusics(Object.fromEntries(data))
      }).catch(() => {})
    }
    refresh()
    global.app_event.on('myListMusicUpdate', refresh)
    return () => { disposed = true; global.app_event.off('myListMusicUpdate', refresh) }
  }, [lists])
  return <FlatList
    data={lists.filter(item => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))}
    keyExtractor={item => item.id} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
    ListHeaderComponent={<View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 20 }}><TextInput value={query} onChangeText={setQuery} placeholder={t('library_filter')} accessibilityLabel={t('library_filter')} placeholderTextColor={colors.secondary} style={[styles.search, { flex: 1 }, { backgroundColor: colors.surface, color: colors.text }]} /><Pressable accessibilityRole="button" accessibilityLabel={t('library_new_playlist')} onPress={onCreate} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text size={28} color={colors.accent}>+</Text></Pressable></View>}
    ListEmptyComponent={<Text color={colors.secondary} style={{ padding: 24, textAlign: 'center' }}>{t('library_no_matches')}</Text>}
    renderItem={({ item }) => {
      const songs = musics[item.id] ?? []
      const pic = songs.find(song => song.meta.picUrl)?.meta.picUrl
      return <View style={[styles.row, { backgroundColor: colors.surface }]}>
        <Pressable style={styles.main} accessibilityRole="button" accessibilityLabel={`${item.name}, ${t('library_song_count', { count: songs.length })}`} onPress={() => { setActiveList(item.id); global.app_event.changeLoveListVisible(false) }}>
          <View style={[styles.art, { backgroundColor: colors.secondarySurface }]}>{pic ? <Image url={pic} style={{ width: 52, height: 52 }} /> : <Icon name="album" size={23} color={colors.accent} />}</View>
          <View style={styles.text}><Text size={17} numberOfLines={2} style={{ fontWeight: '600' }}>{item.name}</Text><Text size={13} color={colors.secondary}>{t('library_song_count', { count: songs.length })}</Text></View>
          {activeId === item.id ? <Text size={20} color={colors.accent}>✓</Text> : null}
        </Pressable>
        <Pressable style={styles.more} onPress={() => { onShowMenu({ listInfo: item, index: lists.findIndex(list => list.id === item.id) }, { x: 0, y: 0, w: 44, h: 44 }) }} accessibilityRole="button" accessibilityLabel={`${t('library_more')} ${item.name}`}><Icon name="dots-vertical" size={20} color={colors.accent} style={{ transform: [{ rotate: '90deg' }] }} /></Pressable>
      </View>
    }}
  />
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  search: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, fontSize: 17 },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, marginBottom: 10, paddingHorizontal: 12 },
  main: { flex: 1, flexDirection: 'row', gap: 14, minHeight: 82, alignItems: 'center', paddingVertical: 12 },
  text: { flex: 1, gap: 4 },
  art: { width: 52, height: 52, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
})
