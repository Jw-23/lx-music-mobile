import { forwardRef, useImperativeHandle, useState } from 'react'
import { type DrawerLayoutAndroidProps, View } from 'react-native'
import { type COMPONENT_IDS } from '@/config/constant'
import Sheet from './Sheet'
import { useWindowSize } from '@/utils/hooks'

interface Props extends DrawerLayoutAndroidProps {
  visibleNavNames: COMPONENT_IDS[]
  widthPercentage: number
  widthPercentageMax?: number
  navigationTitle?: string
}
export interface DrawerLayoutFixedType {
  openDrawer: () => void
  closeDrawer: () => void
  fixWidth: () => void
}
// Compatibility interface for existing category and chart selectors, now presented as a sheet.
export default forwardRef<DrawerLayoutFixedType, Props>(({ children, renderNavigationView, style, navigationTitle }, ref) => {
  const [visible, setVisible] = useState(false)
  const { height } = useWindowSize()
  useImperativeHandle(ref, () => ({
    openDrawer() { setVisible(true) },
    closeDrawer() { setVisible(false) },
    fixWidth() {},
  }))
  return <View style={[{ flex: 1 }, style]}>
    {children}
    <Sheet visible={visible} title={navigationTitle ?? global.i18n.t('library_all')} onClose={() => { setVisible(false) }}>
      <View style={{ height: height * 0.65, padding: 16 }}>{renderNavigationView()}</View>
    </Sheet>
  </View>
})
