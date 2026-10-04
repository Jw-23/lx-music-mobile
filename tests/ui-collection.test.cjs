const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, imports = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  vm.runInNewContext(outputText, { exports, console: { warn() {} }, ...globals, require(name) {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`)
    return imports[name]
  } }, { filename: file })
  return exports
}
const flush = () => new Promise(resolve => setImmediate(resolve))
const song = id => ({ id, name: id, singer: '', source: 'kw', meta: {} })
const identity = load('src/core/sourceListIdentity.ts')
function collection(options = {}) {
  const state = { userList: [...(options.saved || [])] }
  const calls = { creates: [], removes: [], source: [], board: [], overwrites: [], updates: [], busy: [], toasts: [], confirms: 0 }
  const api = {
    getListDetailAll: async(...args) => { calls.source.push(args); return options.load ? options.load(...args) : [song('a'), song('b')] },
  }
  const board = { getListDetailAll: async(...args) => { calls.board.push(args); return options.load ? options.load(...args) : [song('chart')] } }
  const lists = {
    createList: async(info) => {
      calls.creates.push(info)
      state.userList.push({ ...info })
      if (options.save) await options.save(info)
    },
    removeUserList: async(ids) => { calls.removes.push(...ids); state.userList = state.userList.filter(list => !ids.includes(list.id)) },
    overwriteListMusics: async(id, songs) => { calls.overwrites.push({ id, songs }); if (options.overwrite) await options.overwrite(id, songs) },
    setFetchingListStatus: (id, busy) => { calls.busy.push({ id, busy }) },
  }
  const sync = load('src/core/syncSourceList.ts', {
    '@/utils/data': { setListUpdateTime: async(...args) => { calls.updates.push(args) } }, './list': lists,
    '@/core/songlist': api, '@/core/leaderboard': board, './sourceListIdentity': identity,
  }).default
  const tools = { toMD5: value => `md5(${value})`, toast: value => calls.toasts.push(value), confirmDialog: async() => { calls.confirms++; return options.confirm !== false } }
  const collect = load('src/core/collectSourceList.ts', {
    '@/core/list': lists, '@/store/list/state': { default: state }, './syncSourceList': { default: sync },
    '@/utils/tools': tools, './sourceListIdentity': identity,
  }, { global: { i18n: { t: key => key } } }).default
  const imports = { '@/core/list': lists, '@/core/player/player': {}, '@/config/constant': {}, '@/store/list/state': { default: state }, '@/core/collectSourceList': { default: collect }, '@/utils/tools': tools }
  const playlist = load('src/screens/SonglistDetail/listAction.ts', { ...imports, '@/core/songlist': api })
  const charts = load('src/screens/Home/Views/Leaderboard/listAction.ts', { ...imports, '@/core/leaderboard': board })
  return { playlist, charts, collect, sync, state, calls }
}
test('playlist identity accepts legacy and raw remote IDs while keeping different sources and charts separate', () => {
  assert.equal(identity.isSameSourceList({ source: 'kw', sourceListId: '123' }, 'kw', '123'), true)
  assert.equal(identity.isSameSourceList({ source: 'kw', sourceListId: 123 }, 'kw', '123'), true)
  assert.equal(identity.isSameSourceList({ source: 'kw', sourceListId: 'kw__123' }, 'kw', '123'), true)
  assert.equal(identity.isSameSourceList({ source: 'tx', sourceListId: '123' }, 'kw', '123'), false)
  assert.equal(identity.isSameSourceList({ id: 'local' }, 'kw', '123'), false)
  assert.equal(identity.isSameSourceList({ source: 'kw', sourceListId: 'board__123' }, 'kw', '123'), false)
})
test('repeated collection finds the existing raw ID and cancellation leaves the playlist untouched', async() => {
  const saved = { id: 'saved', name: 'Renamed', source: 'kw', sourceListId: '123' }
  const p = collection({ saved: [saved], confirm: false })
  assert.equal(await p.playlist.handleCollect('123', 'kw', 'Remote'), false)
  assert.equal(p.calls.confirms, 1)
  assert.equal(p.calls.source.length, 0)
  assert.equal(p.calls.creates.length, 0)
  assert.equal(p.state.userList[0].name, 'Renamed')
})
test('legacy collection updates the existing playlist using its raw remote ID instead of creating a duplicate', async() => {
  const p = collection({ saved: [{ id: 'saved', name: 'Custom', source: 'kw', sourceListId: 'kw__123' }] })
  assert.equal(await p.playlist.handleCollect('123', 'kw', 'Remote'), true)
  assert.deepEqual(p.calls.source, [['kw', '123', true]])
  assert.equal(p.calls.creates.length, 0)
  assert.equal(p.calls.overwrites[0].id, 'saved')
  assert.equal(p.calls.toasts.at(-1), 'list_update_success')
})
test('concurrent collects share one fetch and success waits for the playlist songs to be saved', async() => {
  let finishSave
  const p = collection({ save: () => new Promise(resolve => { finishSave = resolve }) })
  const first = p.playlist.handleCollect('123', 'kw', 'Remote')
  const second = p.playlist.handleCollect('123', 'kw', 'Remote')
  await flush()
  assert.equal(p.calls.source.length, 1)
  assert.equal(p.calls.creates.length, 1)
  assert.equal(p.calls.toasts.includes('collect_success'), false)
  finishSave()
  assert.equal(await first, true)
  assert.equal(await second, true)
  assert.equal(p.calls.creates[0].sourceListId, '123')
  assert.equal(p.calls.toasts.filter(text => text === 'collect_success').length, 1)
})
test('the same remote ID from different music sources creates independent collections', async() => {
  const p = collection()
  await Promise.all([p.playlist.handleCollect('123', 'kw', 'A'), p.playlist.handleCollect('123', 'tx', 'B')])
  assert.equal(p.calls.creates.length, 2)
  assert.notEqual(p.calls.creates[0].id, p.calls.creates[1].id)
  assert.deepEqual(p.calls.creates.map(info => info.source).sort(), ['kw', 'tx'])
})
test('empty and failed fetches show an error without creating an empty playlist; retry is allowed', async() => {
  let mode = 'error'
  const p = collection({ load: async() => { if (mode === 'error') throw new Error('offline'); return mode === 'empty' ? [] : [song('a')] } })
  assert.equal(await p.playlist.handleCollect('123', 'kw', 'Remote'), false)
  mode = 'empty'
  assert.equal(await p.playlist.handleCollect('123', 'kw', 'Remote'), false)
  assert.equal(p.state.userList.length, 0)
  assert.equal(p.calls.toasts.filter(text => text === 'library_collect_failed').length, 2)
  mode = 'ready'
  assert.equal(await p.playlist.handleCollect('123', 'kw', 'Remote'), true)
  assert.equal(p.state.userList.length, 1)
})
test('failed song storage removes the newly created entry and preserves other saved playlists', async() => {
  const saved = { id: 'other', name: 'Keep', source: 'kw', sourceListId: 'other' }
  const p = collection({ saved: [saved], save: async() => { throw new Error('disk full') } })
  assert.equal(await p.playlist.handleCollect('123', 'kw', 'Remote'), false)
  assert.equal(p.calls.removes.length, 1)
  assert.equal(p.state.userList.length, 1)
  assert.equal(p.state.userList[0].id, 'other')
  assert.equal(p.calls.toasts.includes('collect_success'), false)
})
test('updating a collection waits for storage and never reports success or changes update time on failure', async() => {
  let failSave
  const p = collection({ saved: [{ id: 'saved', name: 'Remote', source: 'kw', sourceListId: '123' }], overwrite: () => new Promise((_resolve, reject) => { failSave = reject }) })
  const pending = p.playlist.handleCollect('123', 'kw', 'Remote')
  await flush()
  assert.deepEqual(p.calls.busy, [{ id: 'saved', busy: true }])
  assert.equal(p.calls.toasts.includes('list_update_success'), false)
  failSave(new Error('disk full'))
  assert.equal(await pending, false)
  assert.equal(p.calls.updates.length, 0)
  assert.deepEqual(p.calls.busy.at(-1), { id: 'saved', busy: false })
})
test('an empty remote response never overwrites the existing saved songs during update', async() => {
  const p = collection({ load: async() => [] })
  await assert.rejects(p.sync({ id: 'saved', source: 'kw', sourceListId: '123' }), /No playlist songs/)
  assert.equal(p.calls.overwrites.length, 0)
  assert.equal(p.calls.updates.length, 0)
  assert.equal(p.calls.busy.at(-1).busy, false)
})
test('chart collections use the same duplicate guard and update through the chart API', async() => {
  const p = collection()
  await p.charts.handleCollect('kw__hot', 'Chart', 'kw')
  await p.charts.handleCollect('kw__hot', 'Chart', 'kw')
  assert.equal(p.calls.creates.length, 1)
  assert.equal(p.calls.creates[0].sourceListId, 'board__kw__hot')
  assert.equal(p.calls.confirms, 1)
  assert.deepEqual(p.calls.board, [['kw__hot'], ['kw__hot', true]])
  assert.equal(p.calls.source.length, 0)
})
function modal(options = {}) {
  const calls = { presented: [], animations: [], hidden: 0 }
  const controller = load('src/components/common/modalTransition.ts').createModalTransition({
    present: value => calls.presented.push(value), hidden: () => { calls.hidden++ },
    animate(opening, complete) {
      const entry = { opening, complete, cancelled: false }
      calls.animations.push(entry)
      if (options.reduced) complete()
      return () => { entry.cancelled = true }
    },
  })
  return { controller, calls }
}
test('a sheet stays mounted during exit and emits hidden only when the exit completes', () => {
  const p = modal()
  p.controller.setVisible(true)
  assert.equal(p.calls.animations.length, 0)
  p.controller.onShow()
  p.controller.setVisible(false)
  assert.deepEqual(p.calls.presented, [true])
  assert.equal(p.calls.hidden, 0)
  p.calls.animations.at(-1).complete()
  assert.deepEqual(p.calls.presented, [true, false])
  assert.equal(p.calls.hidden, 1)
  p.calls.animations.at(-1).complete()
  p.controller.setVisible(false)
  assert.equal(p.calls.hidden, 1)
})
test('rapid close/open cancels the old exit; stale completion cannot dismiss the reopened drawer', () => {
  const p = modal()
  p.controller.setVisible(true); p.controller.onShow()
  p.controller.setVisible(false)
  const exit = p.calls.animations.at(-1)
  p.controller.setVisible(true)
  assert.equal(exit.cancelled, true)
  exit.complete()
  assert.deepEqual(p.calls.presented, [true])
  assert.equal(p.calls.hidden, 0)
  p.controller.setVisible(false)
  p.calls.animations.at(-1).complete()
  assert.equal(p.calls.hidden, 1)
})
test('closing before native onShow does not flash or start an entrance after dismissal', () => {
  const p = modal()
  p.controller.setVisible(true)
  p.controller.setVisible(false)
  p.controller.onShow()
  assert.deepEqual(p.calls.presented, [true, false])
  assert.equal(p.calls.animations.length, 0)
  assert.equal(p.calls.hidden, 1)
})
test('reduced motion completes immediately; changing that preference cancels a running transition', () => {
  const options = { reduced: false }
  const p = modal(options)
  p.controller.setVisible(true); p.controller.onShow(); p.controller.setVisible(false)
  const old = p.calls.animations.at(-1)
  options.reduced = true
  p.controller.refreshMotion()
  assert.equal(old.cancelled, true)
  assert.deepEqual(p.calls.presented, [true, false])
  old.complete()
  assert.equal(p.calls.hidden, 1)
})
test('unmount cancels animations and ignores delayed native callbacks', () => {
  const p = modal()
  p.controller.setVisible(true); p.controller.onShow(); p.controller.setVisible(false)
  const old = p.calls.animations.at(-1)
  p.controller.dispose()
  old.complete(); p.controller.onShow()
  assert.equal(old.cancelled, true)
  assert.equal(p.calls.hidden, 0)
  assert.equal(p.calls.animations.length, 2)
})
test('the collect button works when the source omits a playlist name and ignores repeated presses while saving', async() => {
  const presses = []
  const busy = []
  let finish
  const jsx = (type, props) => ({ type, props })
  const Component = load('src/screens/SonglistDetail/ActionBar.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { memo: value => value, useRef: value => ({ current: value }), useState: value => [value, value => busy.push(value)], useEffect: fn => fn() },
    'react-native': { View: 'View' }, '@/components/common/Button': { default: 'Button' }, '@/components/common/Text': { default: 'Text' },
    '@/utils/tools': { createStyle: value => value }, '@/navigation': {}, '@/store/theme/hook': { useTheme: () => ({}) },
    '@/store/common/state': {}, '@/store/songlist/state': { default: { listDetailInfo: { info: { name: '' } } } },
    '@/lang': { useI18n: () => key => key }, './state': { useListInfo: () => ({ id: '123', source: 'kw', name: 'Route Name' }) },
    '@/store/list/hook': { useMyList: () => [] }, '@/core/sourceListIdentity': identity,
    './listAction': { handleCollect: async(...args) => { presses.push(args); await new Promise(resolve => { finish = resolve }) } },
  }).default
  const button = Component().props.children[0]
  const first = button.props.onPress()
  const second = button.props.onPress()
  assert.deepEqual(presses, [['123', 'kw', 'Route Name']])
  assert.deepEqual(busy, [true])
  finish(); await Promise.all([first, second])
  assert.deepEqual(busy, [true, false])
})
