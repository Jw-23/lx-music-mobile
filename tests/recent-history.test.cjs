const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.join(__dirname, '..')
function loadModule(filename, imports = {}) {
  const source = fs.readFileSync(path.join(root, filename), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  })
  const exports = {}
  vm.runInNewContext(outputText, {
    exports, console,
    require(name) {
      if (!(name in imports)) throw new Error(`Unexpected import ${name}`)
      return imports[name]
    },
  }, { filename })
  return exports
}
const model = loadModule('src/core/player/recentHistoryModel.ts')
const music = id => ({ id, name: `Track ${id}`, singer: 'Artist', source: 'kw', interval: '03:00', meta: { songId: id, albumName: 'Album', qualitys: [], _qualitys: {} } })
const ids = entries => Array.from(entries, entry => entry.musicInfo.id)

function service(saved = [], save = async() => {}) {
  let disk = saved
  const events = new Map()
  const state = { playMusicInfo: { musicInfo: null } }
  const source = fs.readFileSync(path.join(root, 'src/core/player/recentHistory.ts'), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } })
  const exports = {}
  const imports = {
    react: { useSyncExternalStore: (_subscribe, get) => get() },
    '@/plugins/storage': {
      getData: async() => disk,
      saveData: async(_key, data) => { await save(data); disk = JSON.parse(JSON.stringify(data)) },
    },
    '@/store/player/state': { default: state },
    '@/config/constant': { storageDataPrefix: { recentHistory: '@recent_history_v1' } },
    './recentHistoryModel': model,
  }
  vm.runInNewContext(outputText, { exports, console, require: name => imports[name], global: { app_event: { on: (name, callback) => events.set(name, callback) } } })
  return { ...exports, state, emit: name => events.get(name)?.(), disk: () => disk }
}
const tick = () => new Promise(resolve => setImmediate(resolve))

test('a replay moves the song to the front without duplicates and retains only 200 songs', () => {
  let entries = []
  for (let i = 0; i < 205; i++) entries = model.addRecentEntry(entries, music(String(i)), i)
  assert.equal(entries.length, 200)
  assert.equal(ids(entries)[0], '204')
  assert.equal(ids(entries).at(-1), '5')
  entries = model.addRecentEntry(entries, music('100'), 999)
  assert.equal(ids(entries)[0], '100')
  assert.equal(entries[0].playedAt, 999)
  assert.equal(ids(entries).filter(id => id === '100').length, 1)
})

test('restoration ignores malformed entries and keeps the most recent duplicate', () => {
  const good = { musicInfo: music('a'), playedAt: 123 }
  assert.deepEqual(ids(model.parseRecentEntries([null, {}, { ...good, playedAt: 'bad' }, good, good])), ['a'])
  assert.equal(model.parseRecentEntries({ bad: true }).length, 0)
})

test('history survives a new service instance', async() => {
  const first = service()
  await first.recordRecentMusic(music('a'))
  await first.recordRecentMusic(music('b'))
  const restored = service(first.disk())
  await restored.loadRecentHistory()
  assert.deepEqual(ids(restored.useRecentHistory()), ['b', 'a'])
})

test('clear racing a slow save and a new play leaves only the new song on disk and in the UI', async() => {
  let release
  let first = true
  const history = service([], async() => {
    if (first) { first = false; await new Promise(resolve => { release = resolve }) }
  })
  const recording = history.recordRecentMusic(music('a'))
  await tick()
  const clearing = history.clearRecentHistory()
  await tick()
  const newPlay = history.recordRecentMusic(music('b'))
  await tick()
  release()
  await Promise.all([recording, clearing, newPlay])
  assert.deepEqual(ids(history.disk()), ['b'])
  assert.deepEqual(ids(history.useRecentHistory()), ['b'])
})

test('selection and failed loading do not count as listening; resuming does not reorder history', async() => {
  const history = service()
  await history.initRecentHistory()
  history.state.playMusicInfo.musicInfo = music('a')
  history.emit('musicToggled')
  assert.equal(history.useRecentHistory().length, 0)
  history.emit('playerPlaying')
  await tick()
  assert.deepEqual(ids(history.useRecentHistory()), ['a'])
  await history.recordRecentMusic(music('b'))
  history.emit('playerPlaying')
  await tick()
  assert.deepEqual(ids(history.useRecentHistory()), ['b', 'a'])
  history.emit('musicToggled')
  history.emit('playerPlaying')
  await tick()
  assert.deepEqual(ids(history.useRecentHistory()), ['a', 'b'])
})

test('failed clear restores the visible history, and a subsequent write can succeed', async() => {
  let fail = true
  const history = service([{ musicInfo: music('a'), playedAt: 1 }], async() => {
    if (fail) { fail = false; throw new Error('Disk unavailable') }
  })
  await assert.rejects(history.clearRecentHistory(), /Disk unavailable/)
  assert.deepEqual(ids(history.useRecentHistory()), ['a'])
  await history.recordRecentMusic(music('b'))
  assert.deepEqual(ids(history.disk()), ['b', 'a'])
})
