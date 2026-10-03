import { useTheme } from '@/store/theme/hook'

// Semantic roles are shared by every skin; screens never depend on a theme ID.
export const design = {
  radius: { small: 8, card: 16, sheet: 24 },
  space: { small: 8, medium: 16, page: 20, section: 28 },
  type: { largeTitle: 34, title: 22, body: 17, caption: 13 },
  hitSize: 44,
} as const

export const getDesignColors = (theme: LX.ActiveTheme) => ({
  background: theme['c-main-background'],
  surface: theme['c-content-background'],
  secondarySurface: theme.isDark ? '#2C2C2E' : '#F2F2F7',
  text: theme['c-font'],
  secondary: theme.isDark ? '#AEAEB2' : '#636366',
  accent: theme['c-primary'],
  separator: theme.isDark ? '#38383A' : '#E5E5EA',
  destructive: theme.isDark ? '#FF6961' : '#D70015',
})

export const useDesignColors = () => getDesignColors(useTheme())
