import { Pressable, StyleSheet, Switch, View } from 'react-native'
import { tipDialog } from '@/utils/tools'
import { useDesignColors } from '@/theme/design'
import Text from '../Text'
import { Icon } from '../Icon'

export interface CheckBoxProps {
  check: boolean
  label?: string
  children?: React.ReactNode
  onChange: (check: boolean) => void
  disabled?: boolean
  need?: boolean
  size?: number
  marginRight?: number
  marginBottom?: number
  helpTitle?: string
  helpDesc?: string
}
export default ({ check, label, children, onChange, helpTitle, helpDesc, disabled = false, need = false, marginBottom = 0 }: CheckBoxProps) => {
  const colors = useDesignColors()
  const content = label ? <Text size={17} style={{ flex: 1 }} color={colors.text}>{label}</Text> : <View style={{ flex: 1 }}>{children}</View>
  const help = (!!helpTitle || !!helpDesc) ? <Pressable style={styles.help} accessibilityRole="button" accessibilityLabel={helpTitle ?? label} onPress={() => { void tipDialog({ title: helpTitle ?? '', message: helpDesc, btnText: global.i18n.t('understand') }) }}><Icon name="help" size={18} color={colors.secondary} /></Pressable> : null
  return <View style={[styles.container, { marginBottom, opacity: disabled ? 0.4 : 1, borderBottomColor: colors.separator }]}>
    {need ? <Pressable onPress={() => { if (!check) onChange(true) }} disabled={disabled} accessibilityRole="radio" accessibilityState={{ checked: check, disabled }} style={styles.option}>
      {content}<Text size={21} color={colors.accent} style={styles.check}>{check ? '✓' : ''}</Text>
    </Pressable> : <>
      <Pressable style={styles.option} disabled={disabled} accessible={false} onPress={() => { onChange(!check) }}>{content}</Pressable>
      <Switch value={check} disabled={disabled} onValueChange={onChange} accessibilityLabel={label} trackColor={{ false: colors.separator, true: colors.accent }} thumbColor="#FFFFFF" />
    </>}
    {help}
  </View>
}
const styles = StyleSheet.create({
  container: { width: '100%', minHeight: 52, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  option: { flex: 1, minHeight: 52, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 24, textAlign: 'center' },
  help: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
})
