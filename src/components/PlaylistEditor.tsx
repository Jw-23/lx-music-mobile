import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import Sheet from './common/Sheet'
import Text from './common/Text'
import { createList, updateUserList } from '@/core/list'
import listState from '@/store/list/state'
import { toast } from '@/utils/tools'
import { useDesignColors } from '@/theme/design'
import { useI18n } from '@/lang'

export default ({ visible, list, position = -1, onClose, onCreated }: {
  visible: boolean
  list?: LX.List.UserListInfo
  position?: number
  onClose: () => void
  onCreated?: (id: string) => void
}) => {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const colors = useDesignColors()
  const t = useI18n()
  useEffect(() => { if (visible) setName(list?.name ?? '') }, [visible, list])

  const submit = async() => {
    const value = name.trim()
    if (!value || submitting.current) return
    if (listState.allList.some(item => item.id !== list?.id && item.name.trim() === value)) {
      toast(t('library_duplicate'))
      return
    }
    submitting.current = true
    setBusy(true)
    try {
      if (list) await updateUserList([{ ...list, name: value }])
      else {
        const id = `userlist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        await createList({ id, name: value, position })
        onCreated?.(id)
      }
      onClose()
    } catch {
      toast(t('library_save_failed'))
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <Sheet visible={visible} title={t(list ? 'library_rename' : 'library_new_playlist')} onClose={() => { if (!submitting.current) onClose() }}>
      <View style={styles.content}>
        <Text color={colors.secondary} style={styles.label}>{t('library_playlist_name')}</Text>
        <TextInput
          autoFocus value={name} onChangeText={setName} maxLength={80} editable={!busy}
          placeholder={t('library_playlist_name')} placeholderTextColor={colors.secondary}
          accessibilityLabel={t('library_playlist_name')} returnKeyType="done" onSubmitEditing={submit}
          style={[styles.input, { color: colors.text, backgroundColor: colors.secondarySurface }]}
        />
        <Pressable onPress={submit} disabled={!name.trim() || busy} accessibilityRole="button" style={[styles.button, { backgroundColor: colors.accent, opacity: !name.trim() || busy ? 0.5 : 1 }]}>
          <Text color="#FFFFFF" size={17} style={{ fontWeight: '600' }}>{t(busy ? 'library_saving' : 'library_save')}</Text>
        </Pressable>
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 28 },
  label: { marginBottom: 10 },
  input: { minHeight: 48, borderRadius: 12, paddingHorizontal: 14, fontSize: 17 },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginTop: 20 },
})
