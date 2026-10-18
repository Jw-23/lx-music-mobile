import { StyleSheet, View } from 'react-native'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { design } from '@/theme/design'
import { HOME_TABS, type HomeTabId } from '@/config/homeTabs'
import SearchTypeSelector from './Views/Search/SearchTypeSelector'

export default ({ id }: { id: HomeTabId }) => {
  const t = useI18n()
  if (id === 'nav_love' || id === 'nav_setting') return null
  return <View style={styles.header}>
    <Text size={design.type.largeTitle} style={styles.title} accessibilityRole="header">{t(HOME_TABS.find(tab => tab.id === id)!.title)}</Text>
    {id === 'nav_search' ? <SearchTypeSelector /> : null}
  </View>
}
const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontWeight: '700', letterSpacing: 0.3 },
})
