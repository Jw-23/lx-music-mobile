import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import PlaylistEditor from '@/components/PlaylistEditor'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import { useMyList, useActiveListId } from '@/store/list/hook'
import { useNavActiveId } from '@/store/common/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useDesignColors, design } from '@/theme/design'
import { useI18n } from '@/lang'
import { useLayout } from '@/utils/hooks'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { addListMusics, getListMusics, removeUserList, setActiveList } from '@/core/list'
import { setNavActiveId, updateSetting } from '@/core/common'
import { playList, playListById } from '@/core/player/player'
import { clearRecentHistory, useRecentHistory } from '@/core/player/recentHistory'
import { LIST_IDS } from '@/config/constant'
import { confirmDialog, toast } from '@/utils/tools'
import settingState from '@/store/setting/state'
import playerState from '@/store/player/state'
import listState from '@/store/list/state'
import CollectionDetail from './CollectionDetail'

type Route = 'overview' | 'recent' | 'playlist'
const EMPTY_SONGS: LX.Music.MusicInfo[] = []

const Artwork = ({ songs, size, favorite = false }: { songs: LX.Music.MusicInfo[], size: number, favorite?: boolean }) => {
  const colors = useDesignColors()
  const pics = songs.filter(song => song.meta.picUrl).slice(0, 4)
  return <View style={[styles.art, { width: size, height: size, backgroundColor: colors.surface }]}>
    {pics.length ? pics.slice(0, pics.length >= 4 ? 4 : 1).map((song, index) => <Image key={`${song.id}_${index}`} url={song.meta.picUrl} style={{ width: pics.length >= 4 ? size / 2 : size, height: pics.length >= 4 ? size / 2 : size }} />) : <Icon name={favorite ? 'love' : 'album'} size={size * 0.34} color={colors.accent} />}
  </View>
}

export default () => {
  const lists = useMyList()
  const activeId = useActiveListId()
  const navId = useNavActiveId()
  const player = usePlayerMusicInfo()
  const recent = useRecentHistory()
  const colors = useDesignColors()
  const t = useI18n()
  const { width, onLayout } = useLayout()
  const [route, setRoute] = useState<Route>('overview')
  const [query, setQuery] = useState('')
  const [songsByList, setSongsByList] = useState<Record<string, LX.Music.MusicInfo[]>>({})
  const [editorVisible, setEditorVisible] = useState(false)
  const [editingList, setEditingList] = useState<LX.List.UserListInfo>()
  const addRef = useRef<MusicAddModalType>(null)
  const list = lists.find(list => list.id === activeId) ?? (activeId === LIST_IDS.TEMP ? listState.tempList : undefined)
  const songs = songsByList[activeId] ?? EMPTY_SONGS
  const columns = Math.max(2, Math.min(4, Math.floor(width / 220)))
  const cardSize = Math.max(100, (width - 40 - 16 * (columns - 1)) / columns)

  useEffect(() => {
    let cancelled = false
    let revision = 0
    const refresh = () => {
      const current = ++revision
      void Promise.all([...lists, listState.tempList].map(async(list) => [list.id, [...await getListMusics(list.id)]] as [string, LX.Music.MusicInfo[]])).then(data => {
        if (!cancelled && current === revision) setSongsByList(Object.fromEntries(data))
      }).catch(() => { if (!cancelled) toast(t('library_save_failed')) })
    }
    refresh()
    global.app_event.on('myListMusicUpdate', refresh)
    return () => { cancelled = true; global.app_event.off('myListMusicUpdate', refresh) }
  }, [lists, t])

  useEffect(() => {
    const jump = () => {
      const id = playerState.playMusicInfo.listId
      if (id) setActiveList(id)
      setRoute('playlist')
      // The detail list consumes this flag after mounting.
      global.lx.jumpMyListPosition = true
    }
    global.app_event.on('jumpListPosition', jump)
    return () => { global.app_event.off('jumpListPosition', jump) }
  }, [])

  const back = useCallback(() => {
    if (navId !== 'nav_love' || route === 'overview') return false
    setRoute('overview')
    return true
  }, [navId, route])
  useBackHandler(back)
  useEffect(() => {
    // List and selection events can arrive in separate React renders after creation.
    // Consult the store before treating an intermediate missing selection as deletion.
    if (route === 'playlist' && !list && listState.activeListId !== LIST_IDS.TEMP && !listState.allList.some(item => item.id === listState.activeListId)) setRoute('overview')
  }, [list, route])

  const openList = (id: string) => { setActiveList(id); setRoute('playlist') }
  const create = () => { setEditingList(undefined); setEditorVisible(true) }
  const playSong = async(music: LX.Music.MusicInfo) => {
    try {
      await addListMusics(LIST_IDS.DEFAULT, [music], settingState.setting['list.addMusicLocationType'])
      await playListById(LIST_IDS.DEFAULT, music.id)
    } catch { toast(t('library_play_failed')) }
  }
  const playPlaylist = async(shuffle = false) => {
    if (!songs.length) return
    try {
      updateSetting({ 'player.togglePlayMethod': shuffle ? 'random' : 'listLoop' })
      await playList(activeId, shuffle ? Math.floor(Math.random() * songs.length) : 0)
    } catch { toast(t('library_play_failed')) }
  }
  const clearHistory = async() => {
    if (!await confirmDialog({ message: t('library_clear_confirm') })) return
    try { await clearRecentHistory() } catch { toast(t('library_save_failed')) }
  }
  const deletePlaylist = async() => {
    if (!list || list.id === LIST_IDS.DEFAULT || list.id === LIST_IDS.LOVE) return
    if (!await confirmDialog({ message: t('library_delete_confirm', { name: list.name }) })) return
    try { await removeUserList([list.id]); setRoute('overview') } catch { toast(t('library_save_failed')) }
  }
  const manage = () => {
    if (!activeId) setActiveList(LIST_IDS.LOVE)
    setRoute('playlist')
    requestAnimationFrame(() => requestAnimationFrame(() => { global.app_event.changeLoveListVisible(true) }))
  }
  const empty = (history: boolean) => <View style={styles.empty}>
    <Icon name={history ? 'music_time' : 'album'} size={44} color={colors.accent} />
    <Text size={22} style={styles.emptyTitle}>{t(history ? 'library_recent_empty' : 'library_no_music')}</Text>
    <Text size={15} color={colors.secondary} style={styles.emptyHint}>{t(history ? 'library_recent_empty_hint' : 'library_empty_hint')}</Text>
    <Pressable style={styles.action} onPress={() => { setNavActiveId('nav_search') }} accessibilityRole="button"><Text size={17} color={colors.accent}>{t('library_search')}</Text></Pressable>
  </View>

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <View style={styles.header}>
        {route !== 'overview' ? <Pressable style={styles.back} onPress={() => { setRoute('overview') }} accessibilityRole="button" accessibilityLabel={t('library_back')}><Icon name="chevron-left" size={20} color={colors.accent} /><Text color={colors.accent} size={17}>{t('library_title')}</Text></Pressable> : null}
        <View style={styles.heading}>
          <Text size={route === 'overview' ? design.type.largeTitle : 28} style={styles.largeTitle} accessibilityRole="header" numberOfLines={1}>{t(route === 'overview' ? 'library_title' : route === 'recent' ? 'library_recent' : 'library_playlists')}</Text>
          {route === 'overview' ? <Pressable style={styles.action} onPress={create} accessibilityRole="button" accessibilityLabel={t('library_new_playlist')}><Text size={32} color={colors.accent}>+</Text></Pressable> : null}
          {route === 'recent' && recent.length ? <Pressable onPress={clearHistory} style={styles.action} accessibilityRole="button" accessibilityLabel={t('library_clear')}><Icon name="eraser" size={20} color={colors.accent} /></Pressable> : null}
        </View>
      </View>
      {route === 'overview' ? <FlatList
        data={lists.filter(list => list.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))}
        key={columns} numColumns={columns} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.overview}
        columnWrapperStyle={{ gap: 16 }}
        ListHeaderComponent={<>
          <View style={[styles.shortcuts, { backgroundColor: colors.surface }]}>
            <Pressable style={[styles.shortcut, { borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth }]} onPress={() => { setRoute('recent') }} accessibilityRole="button">
              <Icon name="music_time" size={23} color={colors.accent} /><View style={styles.shortcutText}><Text size={17}>{t('library_recent')}</Text><Text size={13} color={colors.secondary}>{t('library_recent_detail')}</Text></View><Icon name="chevron-right" size={14} color={colors.secondary} />
            </Pressable>
            <Pressable style={styles.shortcut} onPress={manage} accessibilityRole="button"><Icon name="slider" size={23} color={colors.accent} /><Text style={styles.shortcutText} size={17}>{t('library_manage')}</Text><Icon name="chevron-right" size={14} color={colors.secondary} /></Pressable>
          </View>
          {recent.length ? <>
            <View style={styles.sectionHeading}><Text size={22} style={styles.sectionTitle}>{t('library_recent')}</Text><Pressable onPress={() => { setRoute('recent') }} style={styles.action} accessibilityRole="button"><Text size={15} color={colors.accent}>{t('library_all')}</Text></Pressable></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
              {recent.slice(0, 8).map(entry => <Pressable key={entry.musicInfo.id} style={{ width: 124 }} onPress={async() => playSong(entry.musicInfo)} accessibilityRole="button" accessibilityLabel={`${t('library_play')} ${entry.musicInfo.name}`}>
                <Artwork songs={[entry.musicInfo]} size={124} />
                <Text size={15} numberOfLines={1} style={{ marginTop: 8 }}>{entry.musicInfo.name}</Text><Text size={13} color={colors.secondary} numberOfLines={1}>{entry.musicInfo.singer}</Text>
              </Pressable>)}
            </ScrollView>
          </> : null}
          <View style={styles.sectionHeading}><Text size={22} style={styles.sectionTitle}>{t('library_playlists')}</Text><Pressable style={styles.action} onPress={create} accessibilityRole="button"><Text size={15} color={colors.accent}>{t('library_new_playlist')}</Text></Pressable></View>
          <TextInput value={query} onChangeText={setQuery} placeholder={t('library_filter')} accessibilityLabel={t('library_filter')} placeholderTextColor={colors.secondary} style={[styles.filter, { backgroundColor: colors.surface, color: colors.text }]} />
        </>}
        renderItem={({ item }) => <Pressable style={styles.card} onPress={() => { openList(item.id) }} accessibilityRole="button" accessibilityLabel={`${item.name}, ${t('library_song_count', { count: songsByList[item.id]?.length ?? 0 })}`}>
          <Artwork songs={songsByList[item.id] ?? EMPTY_SONGS} size={cardSize} favorite={item.id === LIST_IDS.LOVE} />
          <Text size={17} numberOfLines={1} style={styles.cardTitle}>{item.name}</Text>
          <Text size={13} color={colors.secondary}>{t('library_song_count', { count: songsByList[item.id]?.length ?? 0 })}</Text>
        </Pressable>}
        ListEmptyComponent={<Text style={styles.emptyHint} color={colors.secondary}>{t('library_no_matches')}</Text>}
      /> : route === 'recent' ? <FlatList
        data={recent} keyExtractor={entry => entry.musicInfo.id} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1 }}
        ListEmptyComponent={empty(true)}
        renderItem={({ item }) => <View style={[styles.songRow, { borderBottomColor: colors.separator }]}>
          <Pressable style={styles.songMain} onPress={async() => playSong(item.musicInfo)} accessibilityRole="button" accessibilityLabel={`${t('library_play')} ${item.musicInfo.name}`}>
            <Artwork songs={[item.musicInfo]} size={48} />
            <View style={styles.songText}><Text size={17} numberOfLines={1} color={player.id === item.musicInfo.id ? colors.accent : colors.text}>{item.musicInfo.name}</Text><Text size={13} numberOfLines={1} color={colors.secondary}>{item.musicInfo.singer}</Text></View>
          </Pressable>
          <Pressable style={styles.action} onPress={() => { addRef.current?.show({ musicInfo: item.musicInfo, listId: '', isMove: false }) }} accessibilityRole="button" accessibilityLabel={`${t('library_add')} ${item.musicInfo.name}`}><Text size={26} color={colors.accent}>+</Text></Pressable>
        </View>}
      /> : <>
        <View style={styles.playlistSummary}>
          <Artwork songs={songs} size={80} favorite={list?.id === LIST_IDS.LOVE} />
          <View style={{ flex: 1, paddingLeft: 16 }}><Text size={22} style={styles.sectionTitle} numberOfLines={2}>{list?.name}</Text><Text size={13} color={colors.secondary}>{t('library_song_count', { count: songs.length })}</Text></View>
          {list && 'locationUpdateTime' in list ? <Pressable style={styles.action} onPress={() => { setEditingList(list); setEditorVisible(true) }} accessibilityRole="button" accessibilityLabel={t('library_rename')}><Text size={15} color={colors.accent}>{t('list_rename')}</Text></Pressable> : null}
        </View>
        <View style={styles.playActions}>
          <Pressable disabled={!songs.length} onPress={async() => playPlaylist()} accessibilityRole="button" style={[styles.playButton, { backgroundColor: colors.surface, opacity: songs.length ? 1 : 0.5 }]}><Icon name="play" size={16} color={colors.accent} /><Text size={17} color={colors.accent} style={{ marginLeft: 10, fontWeight: '600' }}>{t('library_play')}</Text></Pressable>
          <Pressable disabled={!songs.length} onPress={async() => playPlaylist(true)} accessibilityRole="button" style={[styles.playButton, { backgroundColor: colors.surface, opacity: songs.length ? 1 : 0.5 }]}><Icon name="list-random" size={20} color={colors.accent} /><Text size={17} color={colors.accent} style={{ marginLeft: 10, fontWeight: '600' }}>{t('library_shuffle')}</Text></Pressable>
          {list && 'locationUpdateTime' in list ? <Pressable style={styles.action} onPress={deletePlaylist} accessibilityRole="button" accessibilityLabel={t('library_delete_playlist')}><Icon name="remove" size={20} color={colors.destructive} /></Pressable> : null}
        </View>
        <View style={{ flex: 1 }}>
          <CollectionDetail />
        </View>
      </>}
      <PlaylistEditor visible={editorVisible} list={editingList} onClose={() => { setEditorVisible(false) }} onCreated={openList} />
      <MusicAddModal ref={addRef} />
    </View>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  heading: { flexDirection: 'row', alignItems: 'center' },
  largeTitle: { flex: 1, fontWeight: '700', letterSpacing: 0.3 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 6, alignSelf: 'flex-start' },
  overview: { paddingHorizontal: 20, paddingBottom: 28 },
  shortcuts: { borderRadius: 16, paddingHorizontal: 16, marginTop: 8 },
  shortcut: { minHeight: 64, flexDirection: 'row', alignItems: 'center' },
  shortcutText: { flex: 1, paddingLeft: 14, paddingVertical: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 8 },
  sectionTitle: { fontWeight: '700', flex: 1 },
  action: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  filter: { minHeight: 44, borderRadius: 12, fontSize: 17, paddingHorizontal: 14, marginBottom: 20 },
  card: { flex: 1, paddingBottom: 24, minWidth: 0 },
  cardTitle: { marginTop: 10, marginBottom: 3 },
  art: { borderRadius: 12, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: 180 },
  emptyTitle: { fontWeight: '600', marginTop: 18, textAlign: 'center' },
  emptyHint: { textAlign: 'center', marginVertical: 12, lineHeight: 23 },
  songRow: { flexDirection: 'row', alignItems: 'center', minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth },
  songMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  songText: { flex: 1, paddingHorizontal: 14 },
  playlistSummary: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  playActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  playButton: { flex: 1, flexDirection: 'row', minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
})
