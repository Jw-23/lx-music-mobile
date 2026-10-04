import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

// The home page primes this cache so newly mounted menus can animate immediately
// while retaining the last known accessibility preference.
let lastKnown: boolean | undefined
export default () => {
  const [reduced, setReduced] = useState(lastKnown ?? true)
  useEffect(() => {
    let active = true
    let changed = false
    const update = (value: boolean) => { if (active) { lastKnown = value; setReduced(value) } }
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { changed = true; update(value) })
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (!changed) update(value) }).catch(() => {})
    return () => { active = false; listener.remove() }
  }, [])
  return reduced
}
