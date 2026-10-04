export type ImportPhase = 'idle' | 'downloading' | 'reading' | 'saving'
export interface ImportState {
  phase: ImportPhase
  error?: { kind: 'url' | 'limit' | 'http' | 'script' | 'failed', message?: string }
  imported?: LX.UserApi.UserApiInfo
}
interface Dependencies {
  count: () => number
  download: (url: string) => { promise: Promise<{ statusCode: number, body: unknown }>, cancel: () => void }
  read: (path: string) => Promise<string | null>
  save: (script: string) => Promise<LX.UserApi.UserApiInfo>
  update: (state: ImportState) => void
}

// Keep the user's input intact; reject pasted prose and unsupported protocols.
export const getSourceUrl = (input: string) => {
  const url = input.trim()
  return /^https?:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i.test(url) ? url : null
}
export const isSourceScript = (script: unknown): script is string => {
  return typeof script === 'string' && script.length <= 9_000_000 && /^\/\*[\s\S]+?\*\//.test(script)
}

export const createSourceImport = ({ count, download, read, save, update }: Dependencies) => {
  let revision = 0
  const operation = { busy: false }
  let disposed = false
  let cancelRequest: (() => void) | undefined
  const publish = (state: ImportState) => { if (!disposed) update(state) }
  const run = async(kind: 'url' | 'file', input: string) => {
    if (operation.busy || disposed) return
    if (count() >= 20) { publish({ phase: 'idle', error: { kind: 'limit' } }); return }
    const url = kind === 'url' ? getSourceUrl(input) : null
    if (kind === 'url' && !url) { publish({ phase: 'idle', error: { kind: 'url' } }); return }
    operation.busy = true
    const token = ++revision
    const current = () => !disposed && token === revision
    publish({ phase: kind === 'url' ? 'downloading' : 'reading' })
    try {
      let script: unknown
      if (kind === 'url') {
        const request = download(url!)
        cancelRequest = request.cancel
        const response = await request.promise
        if (!current()) return
        if (response.statusCode < 200 || response.statusCode >= 300) {
          publish({ phase: 'idle', error: { kind: 'http', message: String(response.statusCode) } })
          return
        }
        script = response.body
      } else script = await read(input)
      if (!current()) return
      if (!isSourceScript(script)) { publish({ phase: 'idle', error: { kind: 'script' } }); return }
      // Check again after I/O, because another importer may have changed the list.
      if (count() >= 20) { publish({ phase: 'idle', error: { kind: 'limit' } }); return }
      publish({ phase: 'saving' })
      const imported = await save(script)
      if (current()) publish({ phase: 'idle', imported })
    } catch (error: unknown) {
      if (current()) publish({ phase: 'idle', error: { kind: 'failed', message: error instanceof Error ? error.message : String(error) } })
    } finally {
      cancelRequest = undefined
      operation.busy = false
      if (!disposed && token !== revision) publish({ phase: 'idle' })
    }
  }
  const cancel = () => {
    revision++
    cancelRequest?.()
    // A storage write cannot be cancelled: keep its lock until it settles.
  }
  return {
    importUrl: async(url: string) => run('url', url),
    importFile: async(path: string) => run('file', path),
    cancel,
    dispose() { disposed = true; cancel() },
  }
}
