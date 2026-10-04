const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const base = 'src/screens/Home/Views/Setting/settings/Basic/UserApiEditModal/'
function load(file, imports = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  vm.runInNewContext(outputText, { exports, console, Error, ...globals, require(name) {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`)
    return imports[name]
  } }, { filename: file })
  return exports
}
const flowModule = load(base + 'importFlow.ts')
const script = '/*\n * @name Test Source\n * @version 1.0\n */\nconsole.log("source")'
const info = { id: 'user_api_test', name: 'Test Source', version: '1.0', author: '', description: '', allowShowUpdateAlert: true }
const flush = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
function importing(options = {}) {
  const updates = []; const calls = { download: [], read: [], save: [], cancel: 0 }
  const flow = flowModule.createSourceImport({
    count: () => options.count ?? 0,
    download(url) { calls.download.push(url); return { promise: options.response?.promise ?? Promise.resolve({ statusCode: 200, body: script }), cancel() { calls.cancel++ } } },
    read: async path => { calls.read.push(path); return options.read?.promise ?? script },
    save: async value => { calls.save.push(value); return options.save?.promise ?? info },
    update: value => updates.push(value),
  })
  return { flow, calls, updates, state: () => updates.at(-1), options }
}
test('source links trim whitespace, accept HTTP/S and reject unsupported or incomplete links', () => {
  assert.equal(flowModule.getSourceUrl('  HTTPS://example.com/source.js?token=1\n'), 'HTTPS://example.com/source.js?token=1')
  for (const value of ['', 'file:///source.js', 'https://', 'https://?a=1', 'https://site/source.js extra', 'Download: https://site/file.js']) assert.equal(flowModule.getSourceUrl(value), null)
})
test('invalid input and a full source library do not download or save', async() => {
  const h = importing()
  await h.flow.importUrl('https://')
  assert.equal(h.state().error.kind, 'url')
  h.options.count = 20
  await h.flow.importFile('/source.js')
  assert.equal(h.state().error.kind, 'limit')
  assert.deepEqual(h.calls.download, []); assert.deepEqual(h.calls.read, []); assert.deepEqual(h.calls.save, [])
})
test('URL import waits for persistence before announcing success and prevents duplicate taps', async() => {
  const response = deferred(); const save = deferred(); const h = importing({ response, save })
  const first = h.flow.importUrl(' https://example.com/source.js ')
  await h.flow.importUrl('https://example.com/source.js')
  assert.equal(h.calls.download.length, 1); assert.equal(h.state().phase, 'downloading')
  response.resolve({ statusCode: 200, body: script }); await flush()
  assert.equal(h.state().phase, 'saving'); assert.equal(h.state().imported, undefined)
  await h.flow.importFile('/source.js'); assert.equal(h.calls.save.length, 1)
  save.resolve(info); await first
  assert.equal(h.state().phase, 'idle'); assert.equal(h.state().imported.id, info.id)
})
test('HTTP failures, non-text bodies, HTML and oversized scripts remain retryable errors', async() => {
  for (const response of [{ statusCode: 404, body: script }, { statusCode: 200, body: {} }, { statusCode: 200, body: '<html>error</html>' }, { statusCode: 200, body: script + ' '.repeat(9_000_000) }]) {
    const h = importing({ response: { promise: Promise.resolve(response) } })
    await h.flow.importUrl('https://example.com/source.js')
    assert.equal(h.state().phase, 'idle'); assert.equal(h.state().error.kind, response.statusCode === 404 ? 'http' : 'script'); assert.equal(h.calls.save.length, 0)
    h.options.response.promise = Promise.resolve({ statusCode: 200, body: script })
    await h.flow.importUrl('https://example.com/source.js'); assert.equal(h.state().imported.id, info.id)
  }
})
test('network and storage failures keep retry possible without success feedback', async() => {
  const response = deferred(); const h = importing({ response })
  const first = h.flow.importUrl('https://example.com/source.js')
  response.reject(new Error('offline')); await first
  assert.equal(h.state().error.message, 'offline'); assert.equal(h.state().imported, undefined)
  h.options.response = undefined; h.options.save = { promise: Promise.reject(new Error('disk full')) }
  await h.flow.importFile('/source.js')
  assert.equal(h.state().error.message, 'disk full')
  h.options.save = undefined; await h.flow.importFile('/source.js')
  assert.equal(h.state().imported.id, info.id)
})
test('the capacity is checked again after downloading, including exactly twenty sources', async() => {
  const response = deferred(); const h = importing({ response, count: 19 })
  const pending = h.flow.importUrl('https://example.com/source.js'); h.options.count = 20
  response.resolve({ statusCode: 200, body: script }); await pending
  assert.equal(h.state().error.kind, 'limit'); assert.equal(h.calls.save.length, 0)
})
test('closing during download or file reading ignores delayed results and permits retry after settling', async() => {
  for (const kind of ['url', 'file']) {
    const gate = deferred(); const h = importing(kind === 'url' ? { response: gate } : { read: gate })
    const pending = kind === 'url' ? h.flow.importUrl('https://example.com/source.js') : h.flow.importFile('/source.js')
    h.flow.cancel(); gate.resolve(kind === 'url' ? { statusCode: 200, body: script } : script); await pending
    assert.equal(h.calls.cancel, kind === 'url' ? 1 : 0); assert.equal(h.calls.save.length, 0); assert.equal(h.state().phase, 'idle')
    h.options.response = undefined; h.options.read = undefined; await h.flow.importFile('/source.js')
    assert.equal(h.state().imported.id, info.id)
  }
})
test('closing during persistence keeps the write locked; unmount suppresses all later feedback', async() => {
  const save = deferred(); const h = importing({ save })
  const pending = h.flow.importFile('/source.js'); await flush(); h.flow.cancel()
  await h.flow.importFile('/other.js'); assert.equal(h.calls.save.length, 1)
  h.flow.dispose(); const updateCount = h.updates.length
  save.resolve(info); await pending
  assert.equal(h.updates.length, updateCount); assert.equal(h.updates.some(state => state.imported), false)
})
function sourceCore(options = {}) {
  const state = { list: Array.from({ length: options.count ?? 0 }, (_, i) => ({ id: `old-${i}` })) }
  let pendingSave = options.save; let saves = 0
  const core = load('src/core/userApi.ts', {
    '@/store/userApi': { state, action: { addUserApi: item => state.list.push(item) } },
    '@/utils/data': { addUserApi: async() => { saves++; return pendingSave ? pendingSave.promise : { ...info, id: `new-${saves}` } } },
    '@/utils/nativeModules/userApi': {}, '@/utils/log': { log: {} },
  }, { global: { i18n: { t: key => key } } })
  return { core, state, saves: () => saves, reset: () => { pendingSave = undefined } }
}
test('actual source core serializes import entry points and rejects the twenty-first import', async() => {
  const save = deferred(); const h = sourceCore({ count: 19, save })
  const first = h.core.importUserApi(script); const second = h.core.importUserApi(script)
  const rejected = assert.rejects(second, /user_api_max_tip/)
  await flush(); assert.equal(h.saves(), 1)
  save.resolve(info); assert.equal((await first).id, info.id); await rejected
  assert.equal(h.state.list.length, 20); assert.equal(h.saves(), 1)
})
test('a failed core import does not block later imports or add a phantom item', async() => {
  const save = deferred(); const h = sourceCore({ save })
  const first = h.core.importUserApi(script); const rejected = assert.rejects(first, /disk full/)
  save.reject(new Error('disk full')); await rejected; h.reset()
  assert.equal(h.state.list.length, 0)
  assert.equal((await h.core.importUserApi(script)).id, 'new-2'); assert.equal(h.state.list.length, 1)
})
function sourceStorage() {
  const stored = new Map([['api', []]]); let gate; let fail = false
  const clone = value => JSON.parse(JSON.stringify(value))
  const data = load('src/utils/data.ts', {
    '@/config/constant': { storageDataPrefix: { userApi: 'api' }, DEFAULT_SETTING: {}, LIST_IDS: {} },
    './common': { throttle: fn => fn },
    '@/plugins/storage': {
      getData: async key => clone(stored.get(key)),
      saveDataMultiple: async entries => { if (gate) await gate.promise; if (fail) throw new Error('disk full'); entries.forEach(([key, value]) => stored.set(key, clone(value))) },
      saveData: async(key, value) => { if (fail) throw new Error('disk full'); stored.set(key, clone(value)) },
      removeDataMultiple: async keys => keys.forEach(key => stored.delete(key)),
    },
  }, { global: { i18n: { t: key => key } } })
  return { data, stored, block: value => { gate = value }, fail: value => { fail = value } }
}
test('failed source persistence leaves no in-memory item to duplicate on retry', async() => {
  const h = sourceStorage(); await h.data.getUserApiList(); h.fail(true)
  await assert.rejects(h.data.addUserApi(script), /disk full/)
  h.fail(false); await h.data.addUserApi(script)
  assert.equal(h.stored.get('api').length, 1); assert.equal((await h.data.getUserApiList()).length, 1)
})
test('import, update preferences and removal serialize without resurrecting a removed source', async() => {
  const h = sourceStorage(); await h.data.getUserApiList(); const old = await h.data.addUserApi(script)
  const gate = deferred(); h.block(gate)
  const imported = h.data.addUserApi(script)
  const changed = h.data.setUserApiAllowShowUpdateAlert(old.id, false)
  const ids = [old.id]; const removed = h.data.removeUserApi(ids)
  gate.resolve(); const added = await imported; await changed; const list = await removed
  assert.deepEqual(ids, [old.id]); assert.equal(list.length, 1); assert.equal(list[0].id, added.id)
  assert.equal(h.stored.get('api').length, 1); assert.equal(h.stored.has(`api${old.id}`), false)
})
test('core and persistence publish overlapping import/removal in the same order', async() => {
  const h = sourceStorage(); await h.data.getUserApiList(); const old = await h.data.addUserApi(script)
  const state = { list: [old] }
  const core = load('src/core/userApi.ts', {
    '@/store/userApi': { state, action: { addUserApi: item => state.list.push(item), setUserApiList: list => { state.list = list }, setUserApiAllowShowUpdateAlert: (id, enabled) => { state.list.find(item => item.id === id).allowShowUpdateAlert = enabled } } },
    '@/utils/data': h.data, '@/utils/nativeModules/userApi': {}, '@/utils/log': { log: {} },
  }, { global: { i18n: { t: key => key } } })
  const gate = deferred(); h.block(gate)
  const imported = core.importUserApi(script); const changed = core.setUserApiAllowShowUpdateAlert(old.id, false); const removed = core.removeUserApi([old.id])
  gate.resolve(); const added = await imported; await changed; await removed
  assert.equal(state.list.length, 1); assert.equal(state.list[0].id, added.id)
  assert.equal(h.stored.get('api').length, 1); assert.equal(h.stored.get('api')[0].id, added.id)
})
