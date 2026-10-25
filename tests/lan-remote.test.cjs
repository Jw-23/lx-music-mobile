const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const os = require('node:os')
const { execFileSync } = require('node:child_process')
const ts = require('typescript')
const root = path.join(__dirname, '..')
function load(file, imports = {}) {
  const exports = {}
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } })
  vm.runInNewContext(outputText, { exports, Error, require(name) { if (!(name in imports)) throw Error(name); return imports[name] } })
  return exports
}
const { createLanController, LanCommandError } = load('src/core/lan/controller.ts')
function fixture(overrides = {}) {
  let now = 1000
  const saved = { 'player.startupAutoPlay': false, 'player.togglePlayMethod': 'listLoop' }
  const sources = []; const calls = []
  const songs = [{ id: 'one', name: 'Song <script>', singer: 'Singer', interval: null, source: 'kw', meta: { privatePlaybackInfo: true } }]
  const handle = createLanController({
    settings: () => saved, updateSettings: value => { calls.push(['settings', value]); Object.assign(saved, value) },
    sources: () => sources, selectedSource: () => ({ id: 'existing', ready: false }), platforms: () => [{ id: 'kw', name: '酷我' }],
    download: async url => { calls.push(['download', url]); return '/* source */\ncode' },
    importScript: async script => { const info = { id: 'source', name: 'Imported' }; sources.push(info); calls.push(['import', script]); return info },
    useSource: async id => { calls.push(['source', id]) }, search: async() => ({ list: songs, total: 1, maxPage: 1 }),
    play: async song => { calls.push(['play', song]) }, player: async action => { calls.push(['player', action]) }, nowPlaying: () => ({ playing: false }), now: () => now, ...overrides,
  })
  return { handle: (action, payload, deadline = now + 45000) => handle({ action, payload }, deadline), raw: handle, calls, saved, songs, sources, time: value => { now = value } }
}
test('LAN settings only accept declared keys and values and publish changes through the normal settings entry point', async() => {
  const f = fixture()
  await f.handle('settings.set', { key: 'player.startupAutoPlay', value: true }); assert.equal(f.saved['player.startupAutoPlay'], true)
  for (const payload of [{ key: 'sync.password', value: 'x' }, { key: '__proto__', value: true }, { key: 'player.startupAutoPlay', value: 'false' }, { key: 'player.togglePlayMethod', value: 'invalid' }, { key: 'playDetail.horizontal.style.lrcFontSize', value: NaN }]) await assert.rejects(f.handle('settings.set', payload), error => error.status === 400)
  assert.equal(f.calls.length, 1)
  const state = await f.handle('state'); assert.equal(state.settings.find(item => item.key === 'player.startupAutoPlay').value, true)
  await assert.rejects(f.raw([], 5000), error => error.status === 400)
  await assert.rejects(f.handle('eval', {}), error => error.status === 404)
})
test('LAN imports accept a script or an HTTP URL, refuse malformed content, and never activate the source implicitly', async() => {
  const f = fixture()
  const result = await f.handle('source.import', { script: '/* source */\ncode' }); assert.equal(result.imported.id, 'source')
  await f.handle('source.import', { url: ' https://example.test/source.js ' })
  assert.equal(f.calls.filter(([kind]) => kind === 'import').length, 2)
  assert.equal(f.calls.filter(([kind]) => kind === 'source').length, 0)
  for (const payload of [{ url: 'file:///private/key' }, { url: 'https://bad url' }, { script: 'alert(1)' }, { script: '/* ok */' + 'a'.repeat(4000000) }]) await assert.rejects(f.handle('source.import', payload), error => error.status === 400)
  await f.handle('source.use', { id: 'source' }); assert.equal(f.calls.at(-1)[0], 'source')
  await assert.rejects(f.handle('source.use', { id: 'missing' }), error => error.status === 400)
})
test('download and storage failures are reported and do not activate or fabricate an imported source', async() => {
  const f = fixture({ download: async() => { throw Error('HTTP 404') } })
  await assert.rejects(f.handle('source.import', { url: 'https://example.test/fail.js' }), /HTTP 404/); assert.equal(f.sources.length, 0)
  const g = fixture({ importScript: async() => { throw Error('disk full') } })
  await assert.rejects(g.handle('source.import', { script: '/* source */' }), /disk full/); assert.equal(g.calls.length, 0)
})
test('search returns display fields, keeps original playback metadata on the TV and rejects client-supplied or expired songs', async() => {
  const f = fixture()
  const result = await f.handle('search', { text: 'song', source: 'kw' })
  assert.equal(result.songs[0].meta, undefined)
  await f.handle('play', { resultId: result.resultId, index: 0, song: { id: 'injected' } })
  assert.equal(f.calls.at(-1)[1], f.songs[0])
  await assert.rejects(f.handle('play', { resultId: result.resultId, index: -1 }), error => error.status === 410)
  f.time(602000)
  await assert.rejects(f.handle('play', { resultId: result.resultId, index: 0 }), error => error.status === 410)
  for (const payload of [{ text: '', source: 'kw' }, { text: 'song', source: '__proto__' }, { text: 'song', source: 'kw', page: 1.5 }]) await assert.rejects(f.handle('search', payload), error => error.status === 400)
})
test('mutations serialize and an expired queued operation cannot change the TV after a slow import', async() => {
  let finish
  const f = fixture({ importScript: () => new Promise(resolve => { finish = resolve }) })
  const imported = f.handle('source.import', { script: '/* source */' })
  const setting = f.handle('settings.set', { key: 'player.startupAutoPlay', value: true }, 2000)
  const rejected = assert.rejects(setting, error => error.status === 408)
  await new Promise(resolve => setImmediate(resolve)); assert.equal(f.calls.length, 0)
  const state = await f.handle('state'); assert.ok(state.sources)
  f.time(3000); finish({ id: 'new', name: 'new' }); await imported; await rejected
  assert.equal(f.saved['player.startupAutoPlay'], false)
  await f.handle('player', { action: 'next' }); assert.deepEqual(f.calls.at(-1), ['player', 'next'])
  await assert.rejects(f.handle('player', { action: 'execute' }), error => error.status === 400)
})
test('only two searches may run at once and failure releases capacity', async() => {
  const waiting = []
  const f = fixture({ search: () => new Promise((resolve, reject) => waiting.push({ resolve, reject })) })
  const first = f.handle('search', { text: 'a', source: 'kw' }); const rejected = assert.rejects(first, /failed/)
  const second = f.handle('search', { text: 'b', source: 'kw' })
  await assert.rejects(f.handle('search', { text: 'c', source: 'kw' }), error => error.status === 429)
  waiting[0].reject(Error('failed')); waiting[1].resolve({ list: [], total: 0, maxPage: 0 }); await rejected; await second
  const third = f.handle('search', { text: 'c', source: 'kw' }); waiting[2].resolve({ list: [], total: 0, maxPage: 0 }); await third
})
test('native LAN HTTP authentication, origin checks, size limits and shutdown work over real loopback sockets', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'lx-lan-jvm-'))
  const java = name => process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', name) : name
  const source = path.join(root, 'tests/native/LanServerTest.java')
  const native = path.join(root, 'android/app/src/main/java/cn/toside/music/mobile/lan')
  try {
    execFileSync(java('javac'), ['-d', folder, path.join(native, 'LanAuth.java'), path.join(native, 'LanHttpServer.java'), source], { stdio: 'pipe' })
    execFileSync(java('java'), ['-cp', folder, 'LanServerTest'], { stdio: 'pipe', timeout: 30000 })
  } finally { fs.rmSync(folder, { recursive: true, force: true }) }
})
test('the real native bridge registers once, rejects malformed JSON and converts SDK songs before remote playback', async() => {
  let listener; let starts = 0; let registrations = 0
  const replies = []; const playlist = []; const played = []; const converted = []
  const settings = { 'common.apiSource': '', 'list.addMusicLocationType': 'top' }
  const native = { startIfEnabled: async() => { starts++ }, complete: (id, status, body) => replies.push({ id, status, body: JSON.parse(body) }) }
  const modules = { 'react-native': { NativeModules: { LanRemoteModule: native }, Platform: { OS: 'android' }, NativeEventEmitter: class { addListener(name, fn) { registrations++; listener = fn } } },
    '@/core/lan/controller': { createLanController, LanCommandError }, '@/store/setting/state': { default: { setting: settings } }, '@/store/userApi': { state: { list: [], status: { status: false } } },
    '@/core/common': { updateSetting: value => Object.assign(settings, value) }, '@/core/userApi': { importUserApi() {} }, '@/core/apiSource': { setApiSource() {} },
    '@/utils/musicSdk': { default: { sources: [{ id: 'kw', name: '酷我' }], kw: { musicSearch: { search: async() => ({ list: [{ source: 'kw', songmid: 'old-id', name: 'Track', singer: 'Singer' }], total: 1, allPage: 1 }) } } } },
    '@/utils/request': {}, '@/store/player/state': { default: { musicInfo: {}, progress: {} } }, '@/core/player/player': { playList: async(id, index) => played.push([id, index]) },
    '@/core/list': { addListMusics: async(id, songs) => playlist.push(...songs) }, '@/config/constant': { LIST_IDS: { DEFAULT: 'default' } }, '@/utils/listManage': { getListMusicSync: () => playlist },
    '@/core/player/tvRemoteActions': { createTVRemoteHandler: () => () => true }, '@/utils/log': { log: { warn() {} } },
    '@/utils': { toNewMusicInfo: song => { converted.push(song); return { ...song, id: 'kw-converted', interval: null, meta: { songId: song.songmid } } } },
  }
  const source = fs.readFileSync(path.join(root, 'src/core/init/lanRemote.ts'), 'utf8')
  const exports = {}; vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, { exports, Error, SyntaxError, JSON, setTimeout, clearTimeout, require(name) { if (!(name in modules)) throw Error(name); return modules[name] } })
  await exports.default(); await exports.default(); assert.equal(starts, 1); assert.equal(registrations, 1)
  async function call(body) { const count = replies.length; listener({ id: String(count), body, deadline: Date.now() + 45000 }); for (let i = 0; i < 20 && replies.length === count; i++) await new Promise(resolve => setImmediate(resolve)); assert.equal(replies.length, count + 1); return replies.at(-1) }
  assert.equal((await call('{bad')).status, 400)
  const result = await call(JSON.stringify({ action: 'search', payload: { text: 'track', source: 'kw' } }))
  assert.equal(result.status, 200); assert.equal(result.body.songs[0].id, 'kw-converted'); assert.equal(converted[0].songmid, 'old-id')
  const play = await call(JSON.stringify({ action: 'play', payload: { resultId: result.body.resultId, index: 0 } }))
  assert.equal(play.status, 200); assert.equal(playlist[0].meta.songId, 'old-id'); assert.deepEqual(played, [['default', 0]])
})
