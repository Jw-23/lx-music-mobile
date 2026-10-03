import { memo } from 'react'

import { View } from 'react-native'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useDesignColors } from '@/theme/design'

export default memo(({ title, children }: {
  title: string
  children: React.ReactNode | React.ReactNode[]
}) => {
  const colors = useDesignColors()
  return (
    <View style={styles.container}>
      <Text style={styles.title} size={13} color={colors.secondary}>{title}</Text>
      {children}
    </View>
  )
})


const styles = createStyle({
  container: {
    paddingHorizontal: 4,
    marginBottom: 18,
  },
  title: {
    marginLeft: 0,
    marginBottom: 4,
    // lineHeight: 16,
  },
})
