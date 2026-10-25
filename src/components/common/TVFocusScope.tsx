import { forwardRef } from 'react'
import { requireNativeComponent, View, type ViewProps } from 'react-native'
import useTVMode from '@/utils/hooks/useTVMode'

interface Props extends ViewProps { blocked?: boolean, autoFocus?: boolean }
const NativeScope = requireNativeComponent<Props>('LXTVFocusScope')
export default forwardRef<View, Props>(({ blocked = false, autoFocus = false, ...props }, ref) => {
  const tv = useTVMode()
  return tv ? <NativeScope {...props} ref={ref} blocked={blocked} autoFocus={autoFocus} /> : <View {...props} ref={ref} />
})
