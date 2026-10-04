import { memo } from 'react'
import { Pressable, StyleSheet, Switch, View } from 'react-native'
import { type CheckBoxProps } from '@/components/common/CheckBox'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useDesignColors } from '@/theme/design'
import { tipDialog } from '@/utils/tools'

export default memo(({ check, label, children, onChange, disabled, need, helpTitle, helpDesc, marginBottom = 0 }: CheckBoxProps) => {
  const colors = useDesignColors()
  const locked = (disabled ?? false) || ((need ?? false) && check)
  return <View style={[styles.row, { borderBottomColor: colors.separator, marginBottom }]}>
    <Pressable disabled={locked} onPress={() => { onChange(!check) }} style={styles.label} accessible={false}>
      {label ? <Text style={styles.text} size={16} color={disabled ? colors.secondary : colors.text}>{label}</Text> : children}
    </Pressable>
    {(helpTitle ?? helpDesc) ? <Pressable style={styles.help} accessibilityRole="button" accessibilityLabel={helpTitle ?? label} onPress={async() => { await tipDialog({ title: helpTitle ?? '', message: helpDesc, btnText: global.i18n.t('understand') }) }}><Icon name="help" size={17} color={colors.secondary} /></Pressable> : null}
    <Switch value={check} disabled={locked} onValueChange={onChange} trackColor={{ false: colors.separator, true: colors.accent }} thumbColor="#FFFFFF" ios_backgroundColor={colors.separator} accessibilityLabel={label} />
  </View>
})

const styles = StyleSheet.create({
  row: { width: '100%', flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 4, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  text: { flexShrink: 1, paddingVertical: 10 },
  help: { flexShrink: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
})
