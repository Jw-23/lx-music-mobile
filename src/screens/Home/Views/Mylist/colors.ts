import { useTheme } from '@/store/theme/hook'
import { getDesignColors } from '@/theme/design'

export const getCollectionColors = (theme: LX.ActiveTheme) => ({
  ...getDesignColors(theme),
  ...(theme.isDark ? {
    background: theme.id === 'tv' ? theme['c-main-background'] : '#000000',
    surface: theme.id === 'tv' ? theme['c-content-background'] : '#161618',
    secondarySurface: '#242426',
    text: '#F5F5F7',
    secondary: '#C2C2C7',
    separator: '#303034',
  } : {}),
})

export const useCollectionColors = () => getCollectionColors(useTheme())
