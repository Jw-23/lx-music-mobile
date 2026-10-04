// Keep the native modal mounted until the exit finishes. A newer request always
// invalidates an older animation callback, including close/open interruptions.
export const createModalTransition = ({ present, animate, hidden }: {
  present: (visible: boolean) => void
  animate: (opening: boolean, complete: () => void) => (() => void)
  hidden: () => void
}) => {
  let visible = false
  let mounted = false
  let shown = false
  let revision = 0
  let cancel: (() => void) | undefined
  const interrupt = () => { ++revision; cancel?.(); cancel = undefined }
  const finishHide = () => {
    mounted = false
    shown = false
    present(false)
    hidden()
  }
  const run = () => {
    interrupt()
    const token = revision
    cancel = animate(visible, () => {
      if (token !== revision || visible || !mounted) return
      finishHide()
    })
  }
  return {
    setVisible(next: boolean) {
      if (visible === next) return
      visible = next
      interrupt()
      if (next) {
        if (!mounted) { mounted = true; shown = false; present(true) } else if (shown) run()
      } else if (mounted) {
        if (shown) run()
        else finishHide()
      }
    },
    onShow() { if (!mounted) return; shown = true; if (visible) run() },
    refreshMotion() { if (mounted && shown) run() },
    dispose() { interrupt(); mounted = false; shown = false; visible = false },
  }
}
