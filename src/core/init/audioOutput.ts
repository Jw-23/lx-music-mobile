import { NativeModules, Platform } from 'react-native'
import { setVolume, isInitialized } from '@/plugins/player'

const configure = async(enabled: boolean) => {
  if (Platform.OS !== 'android') return
  await NativeModules.UtilsModule.setLoudnessNormalization(enabled)
}

export default async(setting: LX.AppSetting) => {
  await configure(setting['player.loudnessNormalize'])
  global.state_event.on('configUpdated', (keys, values) => {
    if (keys.includes('player.loudnessNormalize')) {
      void configure(values['player.loudnessNormalize']!).catch((error: unknown) => { console.warn('Audio output setting failed', error) })
    }
    if (keys.includes('player.volume') && isInitialized()) {
      void setVolume(values['player.volume']!).catch((error: unknown) => { console.warn('Audio volume setting failed', error) })
    }
  })
}
