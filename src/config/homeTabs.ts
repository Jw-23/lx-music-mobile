// Keep navigation labels, pager positions and transition directions in one order.
export const HOME_TABS = [
  { id: 'nav_love', icon: 'album', title: 'library_title' },
  { id: 'nav_songlist', icon: 'home', title: 'library_discover' },
  { id: 'nav_top', icon: 'leaderboard', title: 'library_charts' },
  { id: 'nav_search', icon: 'search-2', title: 'library_search' },
  { id: 'nav_setting', icon: 'setting', title: 'library_settings' },
] as const

export const HOME_TAB_IDS = HOME_TABS.map(tab => tab.id)
export const HOME_TAB_INDEX = Object.fromEntries(HOME_TAB_IDS.map((id, index) => [id, index])) as Record<typeof HOME_TAB_IDS[number], number>
