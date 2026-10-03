// Reserve retries synchronously so concurrent native error events cannot all
// start a refresh while getPosition() or a URL request is still pending.
export const createUrlRefreshGuard = (limit = 2) => {
  let revision = 0
  let attempts = 0
  let inFlight = false
  let terminal = false
  return {
    reset() { ++revision; attempts = 0; inFlight = false; terminal = false },
    busy: () => inFlight || terminal,
    reserve() {
      if (inFlight || terminal || attempts >= limit) return null
      ++attempts
      inFlight = true
      return revision
    },
    isCurrent: (token: number) => token === revision,
    finish(token: number) { if (token === revision) inFlight = false },
    fail() { terminal = true; return revision },
  }
}
export const urlRefreshGuard = createUrlRefreshGuard()
