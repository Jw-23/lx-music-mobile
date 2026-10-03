import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useMyList } from '@/store/list/hook'
import { createList, getListMusics } from '@/core/list'
import { useDesignColors } from '@/theme/design'
import { useI18n } from '@/lang'
import { toast } from '@/utils/tools'
import Text from './common/Text'
import { Icon } from './common/Icon'

export default ({ musics, sourceListId, isMove, busy, onSelect }: {
  musics: LX.Music.MusicInfo[]
  sourceListId: string
  isMove: boolean
  busy: boolean
  onSelect: (list: LX.List.MyListInfo) => Promise<void>
}) => {
  const lists = useMyList()
  const colors = useDesignColors()
  const t = useI18n()
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [counts, setCounts] = useState<Record<string, { count: number, exists: boolean }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const creatingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let revision = 0
    const refresh = () => {
      const current = ++revision
      setLoading(true)
      void Promise.all(lists.map(async(list) => {
        const songs = await getListMusics(list.id)
        const ids = new Set(songs.map(song => song.id))
        return [list.id, { count: songs.length, exists: musics.every(music => ids.has(music.id)) }] as const
      })).then(results => {
        if (!cancelled && current === revision) { setCounts(Object.fromEntries(results)); setLoading(false) }
      }).catch(() => { if (!cancelled) { setLoading(false); toast(t('library_save_failed')) } })
    }
    refresh()
    global.app_event.on('myListMusicUpdate', refresh)
    return () => { cancelled = true; global.app_event.off('myListMusicUpdate', refresh) }
  }, [lists, musics, t])

  const createAndSelect = async() => {
    const value = name.trim()
    if (!value || busy || creatingRef.current) return
    if (lists.some(list => list.name.trim() === value)) { toast(t('library_duplicate')); return }
    creatingRef.current = true
    setSaving(true)
    try {
      const id = `userlist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      await createList({ id, name: value })
      setCreating(false)
      setName('')
      await onSelect({ id, name: value, locationUpdateTime: null })
    } catch {
      toast(t('library_save_failed'))
    } finally {
      creatingRef.current = false
      setSaving(false)
    }
  }
  const disabled = busy || saving
  const filtered = lists.filter(list => (!isMove || list.id !== sourceListId) && list.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={styles.content}>
      <View style={styles.song}>
        <View style={[styles.art, { backgroundColor: colors.secondarySurface }]}><Icon name="album" size={24} color={colors.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text size={17} numberOfLines={2} style={{ fontWeight: '600' }}>{musics.length == 1 ? musics[0].name : t('library_song_count', { count: musics.length })}</Text>
          {musics.length == 1 ? <Text size={13} color={colors.secondary} numberOfLines={1}>{musics[0].singer}</Text> : null}
        </View>
      </View>
      <TextInput value={query} onChangeText={setQuery} placeholder={t('library_filter')} accessibilityLabel={t('library_filter')} placeholderTextColor={colors.secondary} style={[styles.input, { backgroundColor: colors.secondarySurface, color: colors.text }]} />
      <Pressable accessibilityRole="button" onPress={() => { setCreating(!creating) }} disabled={disabled} style={styles.row}>
        <Text size={28} color={colors.accent} style={styles.plus}>+</Text>
        <Text size={17} color={colors.accent}>{t('library_create_add')}</Text>
      </Pressable>
      {creating ? <View style={styles.create}>
        <TextInput autoFocus value={name} onChangeText={setName} maxLength={80} editable={!disabled} returnKeyType="done" onSubmitEditing={createAndSelect} placeholder={t('library_playlist_name')} accessibilityLabel={t('library_playlist_name')} placeholderTextColor={colors.secondary} style={[styles.input, { backgroundColor: colors.secondarySurface, color: colors.text }]} />
        <Pressable accessibilityRole="button" onPress={createAndSelect} disabled={!name.trim() || disabled} style={[styles.save, { backgroundColor: colors.accent, opacity: !name.trim() || disabled ? 0.5 : 1 }]}>
          <Text size={16} color="#FFFFFF">{t(disabled ? 'library_saving' : 'library_create_add')}</Text>
        </Pressable>
      </View> : null}
      {loading ? <ActivityIndicator color={colors.accent} style={{ margin: 12 }} /> : null}
      {filtered.map(list => {
        const info = counts[list.id]
        const exists = info?.exists ?? false
        return <Pressable key={list.id} accessibilityRole="button" accessibilityLabel={`${list.name}, ${t(exists ? 'library_exists' : 'library_add')}`} accessibilityState={{ disabled: exists || disabled || loading }} disabled={exists || disabled || loading} onPress={async() => onSelect(list)} style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator, opacity: exists ? 0.6 : 1 }]}>
          <View style={[styles.art, { backgroundColor: colors.secondarySurface }]}><Icon name="album" size={24} color={colors.accent} /></View>
          <View style={{ flex: 1 }}>
            <Text size={17} numberOfLines={1}>{list.name}</Text>
            <Text size={13} color={colors.secondary}>{t('library_song_count', { count: info?.count ?? 0 })}</Text>
          </View>
          <Text size={exists ? 13 : 24} color={colors.accent}>{exists ? t('library_exists') : '+'}</Text>
        </Pressable>
      })}
      {!filtered.length ? <Text color={colors.secondary} style={{ paddingVertical: 20, textAlign: 'center' }}>{t('library_no_matches')}</Text> : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 28 },
  song: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20 },
  art: { width: 48, height: 48, borderRadius: 10, marginRight: 14, alignItems: 'center', justifyContent: 'center' },
  input: { borderRadius: 12, paddingHorizontal: 14, minHeight: 44, fontSize: 17 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 72 },
  plus: { width: 62, textAlign: 'center' },
  create: { paddingBottom: 12 },
  save: { minHeight: 44, marginTop: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
})
