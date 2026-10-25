import { NativeModules } from 'react-native'
export const isTVBuild = NativeModules.UtilsModule?.isTVBuild === true
