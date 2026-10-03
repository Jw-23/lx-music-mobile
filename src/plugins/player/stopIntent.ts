// A programmatic stop advances to the silent placeholder track. That transition
// must not be treated as natural completion (which would start another song).
let manuallyStopped = false
export const markManualStop = () => { manuallyStopped = true }
export const markActiveTrack = () => { manuallyStopped = false }
export const isManualStop = () => manuallyStopped
