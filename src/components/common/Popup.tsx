import { forwardRef } from 'react'
import Dialog, { type DialogProps, type DialogType } from './Dialog'
export interface PopupProps extends Omit<DialogProps, 'presentation' | 'height'> {
  position?: 'top' | 'left' | 'right' | 'bottom'
}
export type PopupType = DialogType
export default forwardRef<PopupType, PopupProps>(({ position, ...props }, ref) => <Dialog ref={ref} {...props} />)
