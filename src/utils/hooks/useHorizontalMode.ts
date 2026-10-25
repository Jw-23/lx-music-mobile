import { useWindowSize } from '@/utils/hooks'
import { isHorizontalMode } from '../tools'
import useTVMode from './useTVMode'


export default () => {
  const windowSize = useWindowSize()
  const tv = useTVMode()

  return tv || isHorizontalMode(windowSize.width, windowSize.height)
}
