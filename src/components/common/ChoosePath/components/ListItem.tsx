import { memo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { type RowInfo } from '@/utils/tools'
import { useDesignColors } from '@/theme/design'
export interface PathItem {
  name: string
  path: string
  isDir: boolean
  mtime?: Date
  desc?: string
  size?: number
  sizeText?: string
  disabled?: boolean
}
export default memo(({ item, onPress, rowInfo }: { item: PathItem, onPress: (item: PathItem) => void, rowInfo: RowInfo }) => {
  const colors = useDesignColors()
  return <Pressable style={({ pressed }) => [styles.row, { width: rowInfo.rowWidth, opacity: item.disabled ? 0.4 : 1, backgroundColor: pressed ? colors.secondarySurface : colors.surface, borderBottomColor: colors.separator }]} disabled={item.disabled} onPress={() => { onPress(item) }} accessibilityRole="button" accessibilityLabel={item.name === '..' ? item.desc : item.name}>
    <View style={[styles.icon, { backgroundColor: colors.secondarySurface }]}><Icon name={item.isDir ? 'add_folder' : 'album'} size={22} color={colors.accent} /></View>
    <View style={styles.text}><Text size={17} numberOfLines={2}>{item.name === '..' ? item.desc : item.name}</Text><Text size={13} color={colors.secondary} numberOfLines={1}>{item.mtime ? new Date(item.mtime).toLocaleString() : item.name === '..' ? '' : item.desc}</Text></View>
    {item.isDir ? <Icon name="chevron-right" color={colors.secondary} size={12} /> : <Text size={13} color={colors.secondary}>{item.sizeText}</Text>}
  </Pressable>
})
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 72, paddingHorizontal: 20, paddingVertical: 12, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 40, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 4 },
})
