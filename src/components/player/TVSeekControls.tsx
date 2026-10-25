import { StyleSheet, View } from 'react-native'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useDesignColors } from '@/theme/design'
import { useI18n } from '@/lang'
import { useProgress } from '@/store/player/hook'
import { seekTVPosition } from '@/core/player/tvRemoteActions'
import useTVMode from '@/utils/hooks/useTVMode'

export default () => {
  const tv = useTVMode()
  const t = useI18n()
  const colors = useDesignColors()
  const { nowPlayTime, maxPlayTime } = useProgress()
  if (!tv) return null
  return <View style={styles.row}>
    {([-1, 1] as const).map(direction => <Button key={direction} disabled={maxPlayTime <= 0} accessibilityRole="button" onPress={() => {
      const position = seekTVPosition(nowPlayTime, maxPlayTime, direction)
      if (position !== null) global.app_event.setProgress(position)
    }} style={[styles.button, { backgroundColor: colors.secondarySurface }]}><Text size={17} color={colors.accent}>{t(direction < 0 ? 'tv_rewind' : 'tv_forward')}</Text></Button>)}
  </View>
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 16, marginVertical: 8 }, button: { flex: 1, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' } })
