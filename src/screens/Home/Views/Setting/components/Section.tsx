import { View } from 'react-native'

import { createStyle } from '@/utils/tools'
import { useDesignColors } from '@/theme/design'
import Text from '@/components/common/Text'


interface Props {
  title: string
  children: React.ReactNode | React.ReactNode[]
}

export default ({ title, children }: Props) => {
  const colors = useDesignColors()

  return (
    <View style={styles.container}>
      <Text style={styles.title} size={22} accessibilityRole="header">{title}</Text>
      <View style={{ backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 12 }}>
        {children}
      </View>
    </View>
  )
}


const styles = createStyle({
  container: {
    marginBottom: 24,
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  title: {
    fontWeight: '700',
    paddingLeft: 4,
    marginBottom: 10,
    // lineHeight: 16,
  },
})
