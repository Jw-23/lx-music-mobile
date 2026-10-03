import { useRef, useImperativeHandle, forwardRef } from 'react'
import { Pressable, type PressableProps, StyleSheet, type View, type ViewProps } from 'react-native'
// import { AppColors } from '@/theme'


export interface BtnProps extends PressableProps {
  ripple?: PressableProps['android_ripple']
  style?: ViewProps['style']
  onChangeText?: (value: string) => void
  onClearText?: () => void
  children: React.ReactNode
}


export interface BtnType {
  measure: (callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void) => void
}

export default forwardRef<BtnType, BtnProps>(({ ripple, disabled, children, style, ...props }, ref) => {
  const btnRef = useRef<View>(null)
  useImperativeHandle(ref, () => ({
    measure(callback) {
      btnRef.current?.measure(callback)
    },
  }))

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => StyleSheet.compose({ minWidth: 44, minHeight: 44, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }, style)}
      {...props}
      ref={btnRef}
    >
      {children}
    </Pressable>
  )
})

