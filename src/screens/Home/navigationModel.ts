// One order for the tab bar, sidebar, native pager and animation direction.
export const HOME_TABS = [
  { id: 'nav_love', icon: 'album', title: 'library_title' },
  { id: 'nav_songlist', icon: 'home', title: 'library_discover' },
  { id: 'nav_top', icon: 'leaderboard', title: 'library_charts' },
  { id: 'nav_search', icon: 'search-2', title: 'library_search' },
  { id: 'nav_setting', icon: 'setting', title: 'library_settings' },
] as const
export type HomeTabId = typeof HOME_TABS[number]['id']
export const HOME_PAGE_IDS = HOME_TABS.map(tab => tab.id)
export const homePageIndex = Object.fromEntries(HOME_TABS.map((tab, index) => [tab.id, index])) as Record<HomeTabId, number>
export const isHomePageNearby = (active: HomeTabId, page: HomeTabId) => Math.abs(homePageIndex[active] - homePageIndex[page]) <= 1
