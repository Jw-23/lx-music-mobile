import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Text from '@/components/common/Text'
import Sheet from '@/components/common/Sheet'
import { openUrl } from '@/utils/tools'
import { useDesignColors } from '@/theme/design'
import { useI18n } from '@/lang'
import List from './List'
import ImportPanel, { type ImportPanelType } from './ImportBtn'

export interface UserApiEditModalType { show: () => void }
export default forwardRef<UserApiEditModalType, {}>((props, ref) => {
  const [visible, setVisible] = useState(false)
  const importer = useRef<ImportPanelType>(null)
  const colors = useDesignColors()
  const t = useI18n()
  useImperativeHandle(ref, () => ({ show() { setVisible(true) } }), [])
  const close = () => { importer.current?.cancel(); setVisible(false) }
  return <Sheet visible={visible} title={t('setting_basic_source_user_api_btn')} onClose={close}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <ImportPanel ref={importer} />
      <View style={[styles.separator, { backgroundColor: colors.separator }]} />
      <List />
      <View style={styles.footer}>
        <Text size={12} color={colors.secondary} style={{ lineHeight: 18 }}>{t('user_api_note')}</Text>
        <Pressable accessibilityRole="link" onPress={() => { void openUrl('https://lyswhut.github.io/lx-music-doc/mobile/custom-source') }} style={styles.help}><Text size={14} color={colors.accent}>{t('user_api_readme')} FAQ</Text></Pressable>
      </View>
    </ScrollView>
  </Sheet>
})
const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  content: { padding: 20, paddingBottom: 28, gap: 24 },
  separator: { height: StyleSheet.hairlineWidth },
  footer: { gap: 4 },
  help: { minHeight: 44, justifyContent: 'center' },
})
