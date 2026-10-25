import { useEffect } from 'react'
import PageContent from '@/components/PageContent'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import AppleShell from './AppleShell'
import TVShell from '../TV/Shell'
import useTVMode from '@/utils/hooks/useTVMode'
import { navigations } from '@/navigation'
import settingState from '@/store/setting/state'


interface Props {
  componentId: string
}


export default ({ componentId }: Props) => {
  const tv = useTVMode()
  useEffect(() => {
    setComponentId(COMPONENT_IDS.home, componentId)
    // eslint-disable-next-line react-hooks/exhaustive-deps

    if (settingState.setting['player.startupPushPlayDetailScreen']) {
      navigations.pushPlayDetailScreen(componentId, true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <PageContent>
      {tv ? <TVShell /> : <AppleShell />}
    </PageContent>
  )
}
