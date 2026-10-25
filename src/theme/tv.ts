import themes from './themes/themes'

export const TV_COLORS = { background: '#0B0C10', surface: '#17191F', elevated: '#252831', text: '#F5F5F7', secondary: '#A6ABB7', accent: '#FF657E', separator: '#2C303A' } as const
const dark = themes.find(theme => theme.id === 'apple_dark')!
// A separate presentation theme; switching builds never rewrites the user's saved skin.
export const getTVTheme = (base: LX.ActiveTheme): LX.ActiveTheme => ({
  ...base,
  ...dark.config.themeColors,
  id: 'tv',
  name: 'LX Music TV',
  isDark: true,
  'c-app-background': TV_COLORS.background,
  'c-main-background': TV_COLORS.background,
  'c-content-background': TV_COLORS.surface,
  'c-font': TV_COLORS.text,
  'c-font-label': TV_COLORS.secondary,
  'c-primary': TV_COLORS.accent,
  'c-primary-font': TV_COLORS.accent,
  'c-primary-font-hover': TV_COLORS.accent,
  'c-primary-font-active': TV_COLORS.accent,
  'c-primary-background': TV_COLORS.elevated,
  'c-primary-background-hover': TV_COLORS.elevated,
  'c-primary-background-active': TV_COLORS.surface,
  'c-primary-input-background': TV_COLORS.elevated,
  'c-button-font': TV_COLORS.accent,
  'c-button-font-selected': TV_COLORS.text,
  'c-button-background': TV_COLORS.elevated,
  'c-button-background-selected': TV_COLORS.elevated,
  'c-button-background-hover': TV_COLORS.elevated,
  'c-button-background-active': TV_COLORS.surface,
  'c-list-header-border-bottom': TV_COLORS.separator,
  'c-border-background': TV_COLORS.separator,
  'bg-image': undefined,
})
export const getTVIconSize = (size: number, rawSize: number | undefined, tv: boolean, phoneSize: number) => rawSize ?? (tv ? size : phoneSize)
