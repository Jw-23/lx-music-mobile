import { Navigation } from 'react-native-navigation'
import { ALERT_MODAL } from './screenNames'

export interface AlertButton { text: string, value: number, destructive?: boolean }
export interface AlertRequest {
  title: string
  message: string
  buttons: AlertButton[]
  cancelable: boolean
}

// Serialize prompts so a second request cannot hide an unanswered confirmation.
let pending: Promise<unknown> = Promise.resolve()
export const showAlert = async(request: AlertRequest): Promise<number> => {
  const result = pending.then(async() => new Promise<number>((resolve, reject) => {
    void Navigation.showOverlay({
      component: {
        name: ALERT_MODAL,
        passProps: { request, onResult: resolve },
        options: {
          layout: { componentBackgroundColor: 'transparent' },
          overlay: { interceptTouchOutside: true },
        },
      },
    }).catch(reject)
  }))
  pending = result.catch(() => {})
  return result
}
