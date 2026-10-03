import { memo } from 'react'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useDesignColors } from '@/theme/design'
import Text from '@/components/common/Text'
import { View } from 'react-native'

// import Title from './components/Title'
import MoreBtn from './components/MoreBtn'
import PlayInfo from './components/PlayInfo'
import ControlBtn from './components/ControlBtn'
import { createStyle } from '@/utils/tools'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'


export default memo(() => {
  const music = usePlayerMusicInfo()
  const colors = useDesignColors()
  return (
    <View style={styles.container} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_player}>
      <View style={{ paddingBottom: 20 }}>
        <Text size={24} style={{ fontWeight: '700' }} numberOfLines={1}>{music.name}</Text>
        <Text size={18} color={colors.accent} numberOfLines={1} style={{ marginTop: 6 }}>{music.singer}</Text>
      </View>
      <PlayInfo />
      <ControlBtn />
      <MoreBtn />
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 0,
    width: '100%',
    // paddingTop: progressContentPadding,
    // marginTop: -progressContentPadding,
    // backgroundColor: 'rgba(0, 0, 0, .1)',
    paddingHorizontal: 28,
    paddingBottom: 24,
    paddingTop: 5,
    // backgroundColor: AppColors.primary,
    // backgroundColor: 'red',
    flexDirection: 'column',
  },
  status: {
    marginTop: 10,
    flexDirection: 'column',
    flex: 0,
    paddingLeft: 5,
    justifyContent: 'space-evenly',
    // backgroundColor: 'rgba(0, 0, 0, .1)',
  },
})
