import { useImperativeHandle, forwardRef, useState } from 'react'
import { type ModalProps as NativeModalProps } from 'react-native'
import AnimatedModal, { type ModalTransition } from './AnimatedModal'

export interface ModalProps extends Omit<NativeModalProps, 'visible'> {
  onHide?: () => void
  keyHide?: boolean
  bgHide?: boolean
  bgColor?: string
  statusBarPadding?: boolean
  transition?: ModalTransition
}
export interface ModalType { setVisible: (visible: boolean) => void }
export default forwardRef<ModalType, ModalProps>(({ onHide, keyHide = true, bgHide = true, bgColor = 'rgba(0,0,0,0)', statusBarPadding, animationType, children, transition, ...props }, ref) => {
  const [visible, setVisible] = useState(false)
  const close = () => { setVisible(false) }
  useImperativeHandle(ref, () => ({ setVisible }))
  return <AnimatedModal {...props} visible={visible} transition={transition} backgroundColor={bgColor} onHidden={onHide} onBackgroundPress={bgHide ? close : undefined} onRequestClose={() => { if (keyHide) close() }} backgroundLabel={global.i18n.t('library_close')}>
    {children}
  </AnimatedModal>
})
