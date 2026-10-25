import { useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import Text from '@/components/common/Text'
import Slider from '@/components/common/Slider'
import { Icon } from '@/components/common/Icon'
import CheckBoxItem from '@/screens/Home/Views/Setting/components/CheckBoxItem'
import { useSettingValue } from '@/store/setting/hook'
import { useDesignColors } from '@/theme/design'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { isInitialized, setVolume } from '@/plugins/player'
import useTVMode from '@/utils/hooks/useTVMode'
import { toast } from '@/utils/tools'

/** One set of output controls for mobile, TV and the player sheet. */
export default () => {
  const t = useI18n()
  const c = useDesignColors()
  const tv = useTVMode()
  const saved = useSettingValue('player.volume')
  const normalize = useSettingValue('player.loudnessNormalize')
  const [preview, setPreview] = useState<number | null>(null)
  const restoreVolume = useRef(saved > 0 ? saved : 0.5)
  const percent = Math.round((preview ?? saved) * 100)
  const change = (value: number) => {
    const volume = Math.max(0, Math.min(100, Math.round(value))) / 100
    if (volume > 0) restoreVolume.current = volume
    setPreview(null)
    updateSetting({ 'player.volume': volume })
  }
  const action = (label: string, onPress: () => void, content: React.ReactNode, disabled = false) => <Pressable disabled={disabled} accessibilityState={{ disabled }} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: c.secondarySurface, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}>{content}</Pressable>
  return <View style={styles.card}>
    <View style={styles.heading}><Text size={17} style={styles.title}>{t('audio_volume')}</Text><Text size={26} color={c.accent} style={styles.percent}>{percent}%</Text></View>
    <View style={styles.controls}>
      {action(t(saved > 0 ? 'audio_mute' : 'audio_unmute'), () => { change(saved > 0 ? 0 : restoreVolume.current * 100) }, <Icon name={percent === 0 ? 'volume-mute' : 'volume-medium'} size={21} color={c.accent} />)}
      {tv ? <View style={styles.meter}><View style={[styles.fill, { backgroundColor: c.accent, width: `${percent}%` }]} /></View> : <Slider minimumValue={0} maximumValue={100} step={1} value={Math.round(saved * 100)} onValueChange={value => {
        setPreview(value / 100)
        if (isInitialized()) void setVolume(value / 100).catch(() => { toast(t('audio_failed')) })
      }} onSlidingComplete={change} />}
      {tv ? <>
        {action(t('audio_quieter'), () => { change(percent - 5) }, <Text size={24}>−</Text>, percent === 0)}
        {action(t('audio_louder'), () => { change(percent + 5) }, <Text size={24}>+</Text>, percent === 100)}
      </> : <Icon name="volume-higt" size={21} color={c.secondary} />}
    </View>
    <Text size={12} color={c.secondary} style={styles.hint}>{t('audio_volume_hint')}</Text>
    {Platform.OS === 'android' ? <>
      <CheckBoxItem label={t('audio_normalize')} check={normalize} onChange={enabled => { updateSetting({ 'player.loudnessNormalize': enabled }) }} helpDesc={t('audio_normalize_help')} />
      <Text size={12} color={c.secondary} style={styles.hint}>{t(normalize ? 'audio_normalize_on' : 'audio_normalize_off')}</Text>
    </> : null}
  </View>
}
const styles = StyleSheet.create({
  card: { width: '100%', paddingHorizontal: 4, paddingVertical: 12, gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { flex: 1, fontWeight: '600' },
  percent: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  button: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  hint: { lineHeight: 19, flexShrink: 1 },
  meter: { flex: 1, minWidth: 60, height: 5, borderRadius: 3, backgroundColor: '#636366', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
})
