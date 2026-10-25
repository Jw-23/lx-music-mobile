import { NativeModules, Platform } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'

export const isTVDevice = Platform.OS === 'android' && (Platform.isTV || NativeModules.UtilsModule?.isTV === true)
export default () => {
  const forced = useSettingValue('common.tvMode')
  return Platform.OS === 'android' && (isTVDevice || forced)
}
