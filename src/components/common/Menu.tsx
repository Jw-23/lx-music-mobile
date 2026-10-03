import { forwardRef, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { Keyboard, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native'
import Modal, { type ModalType } from './Modal'
import Text from './Text'
import { Icon } from './Icon'
import { useWindowSize } from '@/utils/hooks'
import { useDesignColors } from '@/theme/design'
import { useI18n } from '@/lang'

export interface Position { w: number, h: number, x: number, y: number, menuWidth?: number, menuHeight?: number }
export interface MenuSize { width?: number, height?: number }
export type Menus = Readonly<Array<{ action: string, label: string, disabled?: boolean, destructive?: boolean }>>
export interface MenuProps<M extends Menus = Menus> {
  menus: M
  onPress: (menu: M[number]) => void
  onHide?: () => void
  title?: string
  width?: number
  height?: number
  fontSize?: number
  center?: boolean
  activeId?: M[number]['action'] | null
  presentation?: 'actions' | 'selection'
}
export interface MenuType {
  show: (position: Position, menuSize?: MenuSize) => void
  hide: () => void
}
const icons: Record<string, string> = {
  new: 'add_folder',
  rename: 'album',
  sort: 'list-order',
  duplicateMusic: 'album',
  local_file: 'sd-card',
  sync: 'available_updates',
  import: 'download-2',
  export: 'share',
  remove: 'remove',
  play: 'play',
  playLater: 'music_time',
  add: 'add-music',
  move: 'add_folder',
  copyName: 'share',
  dislike: 'close',
  removeCache: 'eraser',
}
const Component = <M extends Menus>({ menus, onPress, onHide, activeId, title, presentation }: MenuProps<M>, ref: Ref<MenuType>) => {
  const modal = useRef<ModalType>(null)
  const [position, setPosition] = useState<Position>({ x: 0, y: 0, w: 0, h: 0 })
  const colors = useDesignColors()
  const window = useWindowSize()
  const t = useI18n()
  const selection = presentation === 'selection' || (presentation !== 'actions' && activeId !== undefined)
  const hide = () => { modal.current?.setVisible(false) }
  useImperativeHandle(ref, () => ({
    show(position) { Keyboard.dismiss(); setPosition(position); modal.current?.setVisible(true) },
    hide,
  }))
  const choose = (item: M[number]) => {
    hide()
    // Let the native modal dismiss before presenting a subsequent editor or confirmation.
    setTimeout(() => { onPress(item) }, 220)
  }
  const width = Math.min(360, window.width - 32)
  const availableHeight = Math.max(120, window.height - 96)
  const height = Math.min(menus.length * 52 + (title ? 54 : 0), availableHeight)
  const top = Math.max(48, Math.min(position.y + position.h, window.height - height - 24))
  const rows = <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
    {title ? <Text size={13} color={colors.secondary} style={styles.title}>{title}</Text> : null}
    {menus.map((item, index) => {
      const destructive = item.destructive ?? /^(remove|delete|clear|dislike)/i.test(item.action)
      const selected = item.action === activeId
      const color = destructive ? colors.destructive : colors.text
      return <Pressable key={item.action} disabled={item.disabled} onPress={() => { choose(item) }} accessibilityRole={selection ? 'radio' : 'button'} accessibilityState={{ disabled: !!item.disabled, selected }} style={({ pressed }) => [styles.row, { borderTopColor: colors.separator, borderTopWidth: index || title ? StyleSheet.hairlineWidth : 0, opacity: item.disabled ? 0.38 : 1, backgroundColor: pressed ? colors.secondarySurface : colors.surface }]}>
        <Text size={17} color={color} style={styles.label}>{item.label}</Text>
        {selected ? <Text color={colors.accent} size={20}>✓</Text> : !selection && icons[item.action] ? <Icon name={icons[item.action]} size={19} color={color} /> : null}
      </Pressable>
    })}
  </ScrollView>
  return <Modal ref={modal} onHide={onHide} bgColor="rgba(0,0,0,0.3)">
    {selection ? <View onStartShouldSetResponder={() => true} style={[styles.popover, { width, maxHeight: availableHeight, top, left: Math.max(16, Math.min(position.x, window.width - width - 16)), backgroundColor: colors.surface }]}>{rows}</View> : <SafeAreaView style={styles.overlay} pointerEvents="box-none">
      <View onStartShouldSetResponder={() => true} style={[styles.actions, { maxHeight: Math.max(100, Math.min(window.height * 0.78, window.height - 140)), backgroundColor: colors.surface }]}>{rows}</View>
      <Pressable onPress={hide} accessibilityRole="button" style={({ pressed }) => [styles.cancel, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}><Text size={17} color={colors.accent} style={{ fontWeight: '600' }}>{t('cancel')}</Text></Pressable>
    </SafeAreaView>}
  </Modal>
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12 },
  actions: { width: '100%', maxWidth: 640, borderRadius: 14, overflow: 'hidden' },
  popover: { position: 'absolute', borderRadius: 14, overflow: 'hidden', elevation: 12, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  title: { paddingHorizontal: 20, paddingVertical: 16, textAlign: 'center', fontWeight: '600' },
  row: { minHeight: 52, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 16 },
  label: { flex: 1, lineHeight: 24 },
  cancel: { width: '100%', maxWidth: 640, borderRadius: 14, minHeight: 56, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
})
export default forwardRef(Component) as <M extends Menus>(p: MenuProps<M> & { ref?: Ref<MenuType> }) => JSX.Element | null
