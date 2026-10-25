import CheckBox from '@/components/common/CheckBox'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { isTVDevice } from '@/utils/hooks/useTVMode'

export default () => {
  const t = useI18n()
  const forced = useSettingValue('common.tvMode')
  return <CheckBox check={isTVDevice || forced} disabled={isTVDevice} label={t('tv_mode')} helpTitle={t('tv_mode')} helpDesc={t('tv_mode_hint')} onChange={value => { updateSetting({ 'common.tvMode': value }) }} />
}
