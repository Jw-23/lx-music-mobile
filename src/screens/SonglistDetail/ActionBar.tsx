import { memo, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import Button from '@/components/common/Button'

import { createStyle } from '@/utils/tools'
import { pop } from '@/navigation'
import { useTheme } from '@/store/theme/hook'
import commonState from '@/store/common/state'
import Text from '@/components/common/Text'
import { handleCollect, handlePlay } from './listAction'
import songlistState from '@/store/songlist/state'
import { useI18n } from '@/lang'
import { useListInfo } from './state'
import { useMyList } from '@/store/list/hook'
import { isSameSourceList } from '@/core/sourceListIdentity'
// import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'

export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const info = useListInfo()
  const lists = useMyList()
  const collected = lists.some(list => isSameSourceList(list, info.source, info.id))
  const [collecting, setCollecting] = useState(false)
  const pending = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const back = () => {
    void pop(commonState.componentIds.songlistDetail!)
  }

  const handlePlayAll = () => {
    if (!songlistState.listDetailInfo.info.name) return
    void handlePlay(info.id, info.source, songlistState.listDetailInfo.list)
  }

  const handleCollection = async() => {
    if (!info.id || pending.current) return
    pending.current = true
    setCollecting(true)
    try {
      await handleCollect(info.id, info.source, songlistState.listDetailInfo.info.name ? songlistState.listDetailInfo.info.name : info.name)
    } finally {
      pending.current = false
      if (mounted.current) setCollecting(false)
    }
  }

  return (
    <View style={styles.container}>
      <Button onPress={handleCollection} disabled={collecting || !info.id} accessibilityState={{ busy: collecting }} style={styles.controlBtn}>
        <Text style={{ ...styles.controlBtnText, color: theme['c-button-font'] }}>{t(collecting ? 'library_collecting' : collected ? 'library_collected' : 'collect_songlist')}</Text>
      </Button>
      <Button onPress={handlePlayAll} style={styles.controlBtn}>
        <Text style={{ ...styles.controlBtnText, color: theme['c-button-font'] }}>{t('play_all')}</Text>
      </Button>
      <Button onPress={back} style={styles.controlBtn}>
        <Text style={{ ...styles.controlBtnText, color: theme['c-button-font'] }}>{t('back')}</Text>
      </Button>
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
  },
  controlBtn: {
    flexGrow: 1,
    flexShrink: 1,
    width: '33%',
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 10,
    paddingRight: 10,
  },
  controlBtnText: {
    fontSize: 13,
    textAlign: 'center',
  },
})

