import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native'
export interface Props {
  status: 'checked' | 'unchecked' | 'indeterminate'
  disabled?: boolean
  onPress?: (e: GestureResponderEvent) => void
  size?: number
  tintColors: { true: string, false: string }
}
export default ({ status, disabled, onPress, size = 1, tintColors }: Props) => {
  const selected = status !== 'unchecked'
  const diameter = 22 * size
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ disabled, checked: status === 'indeterminate' ? 'mixed' : selected }} style={styles.hit}>
    <View style={{ width: diameter, height: diameter, borderRadius: diameter / 2, borderWidth: 1.5, borderColor: selected ? tintColors.true : tintColors.false, backgroundColor: selected ? tintColors.true : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {selected ? <View style={status === 'indeterminate' ? styles.minus : styles.tick} /> : null}
    </View>
  </Pressable>
}
const styles = StyleSheet.create({
  hit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 11, height: 6, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: '#FFFFFF', transform: [{ rotate: '-45deg' }], marginTop: -3 },
  minus: { width: 11, height: 2, backgroundColor: '#FFFFFF' },
})
