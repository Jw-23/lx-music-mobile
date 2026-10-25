import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { TV_COLORS } from '@/theme/tv'
import { TV_LAYOUT } from './layout'

export default ({ icon, label, onPress, disabled = false, primary = false, preferred = false, style }: {
  icon: string
  label: string
  onPress: () => void
  disabled?: boolean
  primary?: boolean
  preferred?: boolean
  style?: StyleProp<ViewStyle>
}) => {
  const size = primary ? TV_LAYOUT.playButton : TV_LAYOUT.button
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} hasTVPreferredFocus={preferred} onPress={onPress} style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: primary ? TV_COLORS.text : TV_COLORS.elevated, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 }, styles.button, style]}>
    <Icon name={icon} rawSize={primary ? TV_LAYOUT.playIcon : TV_LAYOUT.icon} color={primary ? TV_COLORS.background : TV_COLORS.text} />
  </Pressable>
}
const styles = StyleSheet.create({ button: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 } })
