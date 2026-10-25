// import { useEffect, useState } from 'react'
import { View, NativeModules } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import ImageBackground from '@/components/common/ImageBackground'
import { useWindowSize } from '@/utils/hooks'
import { useMemo, useEffect } from 'react'
import useTVMode from '@/utils/hooks/useTVMode'
import TVFocusScope from './common/TVFocusScope'
import { scaleSizeAbsHR } from '@/utils/pixelRatio'
import { defaultHeaders } from './common/Image'
import SizeView from './SizeView'
import { useBgPic } from '@/store/common/hook'

interface Props {
  children: React.ReactNode
  tvInsets?: boolean
}

const BLUR_RADIUS = Math.max(scaleSizeAbsHR(18), 10)

export default ({ children, tvInsets = true }: Props) => {
  const theme = useTheme()
  const tv = useTVMode()
  useEffect(() => { NativeModules.UtilsModule?.setTVMode?.(tv) }, [tv])
  const windowSize = useWindowSize()
  const pic = useBgPic()
  const content = useMemo(() => <View style={{ flex: 1, paddingHorizontal: tv && tvInsets ? 28 : 0, paddingVertical: tv && tvInsets ? 18 : 0 }}>{children}</View>, [children, tv, tvInsets])
  // const [wh, setWH] = useState<{ width: number | string, height: number | string }>({ width: '100%', height: Dimensions.get('screen').height })

  // 固定宽高度 防止弹窗键盘时大小改变导致背景被缩放
  // useEffect(() => {
  //   const onChange = () => {
  //     setWH({ width: '100%', height: '100%' })
  //   }

  //   const changeEvent = Dimensions.addEventListener('change', onChange)
  //   return () => {
  //     changeEvent.remove()
  //   }
  // }, [])
  // const handleLayout = (e: LayoutChangeEvent) => {
  //   // console.log('handleLayout', e.nativeEvent)
  //   // console.log(Dimensions.get('screen'))
  //   setWH({ width: e.nativeEvent.layout.width, height: Dimensions.get('screen').height })
  // }
  // console.log('render page content')

  const themeComponent = useMemo(() => (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <ImageBackground
        style={{ position: 'absolute', left: 0, top: 0, height: windowSize.height, width: windowSize.width, backgroundColor: theme['c-content-background'] }}
        source={theme['bg-image']}
        resizeMode="cover"
      >
      </ImageBackground>
      <View style={{ flex: 1, flexDirection: 'column', backgroundColor: theme['c-main-background'] }}>
        {content}
      </View>
    </View>
  ), [content, theme, windowSize.height, windowSize.width])
  const picComponent = useMemo(() => {
    return (
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <ImageBackground
          style={{ position: 'absolute', left: 0, top: 0, height: windowSize.height, width: windowSize.width, backgroundColor: theme['c-content-background'] }}
          source={{ uri: pic!, headers: defaultHeaders }}
          resizeMode="cover"
          blurRadius={BLUR_RADIUS}
        >
          <View style={{ flex: 1, flexDirection: 'column', backgroundColor: theme['c-content-background'], opacity: 0.76 }}></View>
        </ImageBackground>
        <View style={{ flex: 1, flexDirection: 'column' }}>
          {content}
        </View>
      </View>
    )
  }, [content, pic, theme, windowSize.height, windowSize.width])

  return (
    <>
      <SizeView />
      <TVFocusScope style={{ flex: 1, backgroundColor: theme['c-main-background'] }}>{pic && !tv ? picComponent : themeComponent}</TVFocusScope>
    </>
  )
}
