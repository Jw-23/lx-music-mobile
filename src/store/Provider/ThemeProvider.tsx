import { memo, useEffect, useState, useMemo } from 'react'

import useTVMode from '@/utils/hooks/useTVMode'
import { getTVTheme } from '@/theme/tv'
import QuickAddProvider from '@/components/QuickAddProvider'
import themeState, { ThemeContext } from '../theme/state'


export default memo(({ children }: {
  children: React.ReactNode
}) => {
  const tv = useTVMode()
  const [theme, setTheme] = useState(themeState.theme)

  useEffect(() => {
    const handleUpdateTheme = (theme: LX.ActiveTheme) => {
      requestAnimationFrame(() => {
        setTheme(theme)
      })
    }
    global.state_event.on('themeUpdated', handleUpdateTheme)
    return () => {
      global.state_event.off('themeUpdated', handleUpdateTheme)
    }
  }, [])

  const activeTheme = useMemo(() => tv ? getTVTheme(theme) : theme, [tv, theme])
  return (
    <ThemeContext.Provider value={activeTheme}>
      <QuickAddProvider>{children}</QuickAddProvider>
    </ThemeContext.Provider>
  )
})
