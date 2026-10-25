import { View } from 'react-native'
import Language from '../Home/Views/Setting/settings/Basic/Language'
import StartupPlay from '../Home/Views/Setting/settings/Basic/IsStartupAutoPlay'
import StartupPlayer from '../Home/Views/Setting/settings/Basic/IsStartupPushPlayDetailScreen'
import ShowExit from '../Home/Views/Setting/settings/Basic/IsShowExitBtn'
import LanRemoteButton from '@/components/LanRemotePanel'

export default () => <View><LanRemoteButton /><StartupPlay /><StartupPlayer /><ShowExit /><Language /></View>
