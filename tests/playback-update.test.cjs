const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, imports = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } })
  const exports = {}
  vm.runInNewContext(outputText, { exports, console, setTimeout, clearTimeout, ...globals, require(name) {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`)
    return imports[name]
  } }, { filename: file })
  return exports
}
const repository = load('src/config/release.js')
const releases = load('src/utils/releaseModel.js', { '@/config/release': repository })
const release = (version = '1.10.2', assets = ['arm64-v8a', 'universal']) => ({
  tag_name: `v${version}`, draft: false, prerelease: false, published_at: '2026-10-03', body: '### Changes\n- Queue',
  assets: assets.map(abi => ({ name: `lx-music-mobile-v${version}-${abi}.apk`, state: 'uploaded', size: 100, browser_download_url: `${repository.RELEASE_URL}/download/v${version}/lx-music-mobile-v${version}-${abi}.apk` })),
})
const song = id => ({ id, name: id, singer: '', source: 'local', meta: {} })
const ids = songs => Array.from(songs, song => song.id)

test('stable published release tags and notes are parsed; drafts and prereleases are rejected', () => {
  const info = releases.parseRelease(release())
  assert.equal(info.version, '1.10.2')
  assert.equal(info.desc, 'Changes\n- Queue')
  for (const bad of [null, {}, { ...release(), draft: true }, { ...release(), prerelease: true }, release('1.10.2-beta.1'), { ...release(), published_at: null }]) {
    assert.throws(() => releases.parseRelease(bad))
  }
})
test('APK selection respects device ABI preference and falls back to a published universal asset', () => {
  const info = release('1.10.2', ['arm64-v8a', 'x86_64', 'universal'])
  assert.match(releases.selectReleaseAsset(info, ['x86_64', 'arm64-v8a']), /x86_64\.apk$/)
  assert.match(releases.selectReleaseAsset(info, ['armeabi-v7a']), /universal\.apk$/)
  assert.throws(() => releases.selectReleaseAsset(release('1.10.2', ['arm64-v8a']), ['x86']))
})
test('APK selection rejects foreign repository URLs and empty or unfinished assets', () => {
  for (const patch of [{ browser_download_url: 'https://github.com/lyswhut/lx-music-mobile/releases/download/v1.10.2/a.apk' }, { size: 0 }, { state: 'new' }]) {
    const info = release('1.10.2', ['arm64-v8a'])
    Object.assign(info.assets[0], patch)
    assert.throws(() => releases.selectReleaseAsset(info, ['arm64-v8a']))
  }
})
function updateService({ latest = release(), history = [], failLatest = false, failHistory = false, downloadResult = { statusCode: 200, bytesWritten: 100 } } = {}) {
  const urls = []
  const downloads = []
  const installs = []
  const service = load('src/utils/version.js', {
    '@/config/release': repository, './releaseModel': releases,
    '@/utils/request': { httpGet: (url, _options, done) => {
      urls.push(url)
      const isLatest = url.endsWith('/latest')
      const isHistory = url.includes('?')
      if ((isLatest && failLatest) || (isHistory && failHistory)) done(new Error('Unavailable'), null, null)
      else done(null, { statusCode: 200 }, isLatest ? latest : isHistory ? history : release('1.10.1'))
    } },
    '@/utils/fs': { temporaryDirectoryPath: '/tmp', stopDownload() {}, downloadFile: (url, target) => {
      downloads.push(url)
      return { jobId: 1, promise: Promise.resolve(downloadResult) }
    } },
    '@/utils/nativeModules/utils': { getSupportedAbis: async() => ['arm64-v8a'], installApk: async(path) => { installs.push(path) } },
    '@/config/constant': { APP_PROVIDER_NAME: 'provider' },
  })
  return { ...service, urls, downloads, installs }
}
test('checking and history only request the fork API; optional history failure does not fail latest', async() => {
  const service = updateService({ failHistory: true })
  assert.equal((await service.getVersionInfo()).version, '1.10.2')
  assert.ok(service.urls.every(url => url.startsWith(repository.RELEASE_API_URL)))
  assert.ok(service.urls.some(url => url.endsWith('/latest')))
  await service.downloadNewVersion('1.10.2')
  assert.match(service.downloads[0], /Jw-23\/lx-music-mobile\/releases\/download\/v1.10.2/)
  assert.equal(service.installs.length, 1)
})
test('a newer latest release never changes the version of the APK the user selected', async() => {
  const service = updateService()
  await service.getVersionInfo()
  await service.downloadNewVersion('1.10.1')
  assert.ok(service.urls.some(url => url.endsWith('/tags/v1.10.1')))
  assert.match(service.downloads[0], /v1.10.1/)
})
test('API failure and failed APK download never fall back to upstream or launch installation', async() => {
  const unavailable = updateService({ failLatest: true })
  await assert.rejects(unavailable.getVersionInfo(), /Unavailable/)
  assert.ok(unavailable.urls.every(url => url.startsWith(repository.RELEASE_API_URL)))
  for (const downloadResult of [{ statusCode: 404, bytesWritten: 100 }, { statusCode: 200, bytesWritten: 0 }]) {
    const service = updateService({ downloadResult })
    await service.getVersionInfo()
    await assert.rejects(service.downloadNewVersion('1.10.2'), /download failed/)
    assert.equal(service.installs.length, 0)
  }
})

function playback(options = {}) {
  const queue = load('src/core/player/playbackQueue.ts')
  const songs = ['a', 'b', 'c', 'd'].map(song)
  const state = { isPlay: false, progress: { nowPlayTime: 0 }, musicInfo: {}, playInfo: { playerListId: 'saved', playerPlayIndex: 1, playIndex: 1 }, playMusicInfo: { musicInfo: songs[1], listId: 'saved', isTempPlay: false }, playedList: [], tempPlayList: [] }
  const actions = { setMusicInfo() {}, updatePlayIndex(playIndex, playerPlayIndex) { Object.assign(state.playInfo, { playIndex, playerPlayIndex }) }, setPlayMusicInfo(listId, musicInfo, isTempPlay) { state.playMusicInfo = { listId, musicInfo, isTempPlay } }, setPlayListId(id) { state.playInfo.playerListId = id } }
  const playInfo = load('src/core/player/playInfo.ts', {
    '@/store/player/action': { default: actions }, '@/store/player/state': { default: state },
    '@/utils/listManage': { getListMusicSync: id => id === 'saved' ? songs : [] }, '@/core/player/progress': { setProgress() {} },
    '@/config/constant': { LIST_IDS: {} }, './playbackQueue': queue,
  }, { global: { app_event: { musicToggled() {} } } })
  const clearPlayedList = () => { state.playedList = [] }
  const settings = { setting: { 'player.togglePlayMethod': 'listLoop' } }
  const statuses = []
  let stops = 0
  const guard = load('src/core/player/urlRefreshGuard.ts')
  const player = load('src/core/player/player.ts', {
    '@/plugins/player': { isInitialized: () => true, setStop: async() => { stops++ }, ...options.native }, '@/core/player/playStatus': { setStatusText: text => statuses.push(text) },
    '@/store/player/state': { default: state }, '@/store/setting/state': { default: settings }, '@/core/player/playInfo': playInfo,
    '@/core/player/playedList': { clearPlayedList, removePlayedList: index => state.playedList.splice(index, 1) },
    '@/core/player/tempPlayList': { clearTempPlayeList: () => { state.tempPlayList = [] }, removeTempPlayList: index => state.tempPlayList.splice(index, 1) },
    '@/core/music': options.music || {}, '@/utils/message': { requestMsg: { tooManyRequests: 'rate limited', cancelRequest: 'cancelled' } }, '@/utils/common': { getRandom: () => 2 },
    './utils': { filterList: async({ list, playerMusicInfo }) => ({ filteredList: list, playerIndex: list.findIndex(s => s.id === playerMusicInfo?.id) }) },
    'react-native-background-timer': { default: options.timer || { clearTimeout() {} } }, '@/utils/tools': { debounceBackgroundTimer: () => () => {} },
    '@/config/constant': { LIST_IDS: {} }, '@/core/list': {}, './playbackQueue': queue, './urlRefreshGuard': guard, '@/core/dislikeList': {},
  }, { ...options.globals, global: { lx: {}, i18n: { t: key => key }, app_event: { pause() {}, error() { state.isPlay = false } } } })
  return { queue, songs, state, playInfo, player, settings, statuses, stops: () => stops, guard }
}
test('reordering and removal change actual next and previous playback without changing the saved playlist', async() => {
  const p = playback()
  p.queue.moveQueueSong('saved', p.songs, 3, 2)
  p.playInfo.updatePlayIndex()
  assert.deepEqual(ids(p.playInfo.getList('saved')), ['a', 'b', 'd', 'c'])
  assert.equal((await p.player.getNextPlayMusicInfo()).musicInfo.id, 'd')
  await p.player.playNext()
  assert.equal(p.state.playMusicInfo.musicInfo.id, 'd')
  assert.equal(p.state.playInfo.playerPlayIndex, 2)
  await p.player.playPrev()
  assert.equal(p.state.playMusicInfo.musicInfo.id, 'b')
  p.queue.removeQueueSong('saved', p.songs, 'd', 'b')
  p.playInfo.updatePlayIndex()
  await p.player.playNext()
  assert.equal(p.state.playMusicInfo.musicInfo.id, 'c')
  assert.deepEqual(ids(p.songs), ['a', 'b', 'c', 'd'])
})
test('moving the current song updates the playback index while its saved playlist index remains correct', async() => {
  const p = playback()
  p.queue.moveQueueSong('saved', p.songs, 1, 3)
  p.playInfo.updatePlayIndex()
  assert.equal(p.state.playInfo.playIndex, 1)
  assert.equal(p.state.playInfo.playerPlayIndex, 3)
  await p.player.playNext()
  assert.equal(p.state.playMusicInfo.musicInfo.id, 'a')
  p.queue.removeQueueSong('saved', p.songs, 'a', 'a')
  assert.equal(p.playInfo.getList('saved').length, 4)
})
test('selecting within the queue keeps edits; starting a saved playlist resets them', async() => {
  const p = playback()
  p.queue.moveQueueSong('saved', p.songs, 3, 2)
  await p.player.playQueueSong(p.songs[3], 'saved')
  assert.deepEqual(ids(p.playInfo.getList('saved')), ['a', 'b', 'd', 'c'])
  await p.player.playList('saved', 1)
  assert.deepEqual(ids(p.playInfo.getList('saved')), ['a', 'b', 'c', 'd'])
  assert.equal(p.state.playMusicInfo.musicInfo.id, 'b')
})
test('Play Later remains a priority queue and normal playback resumes at the correct session index', async() => {
  const p = playback()
  p.queue.moveQueueSong('saved', p.songs, 3, 2)
  p.state.tempPlayList = [{ musicInfo: song('later'), listId: 'other', isTempPlay: true }]
  await p.player.playNext()
  assert.equal(p.state.playMusicInfo.musicInfo.id, 'later')
  assert.equal(p.state.playInfo.playerPlayIndex, 1)
  await p.player.playNext()
  assert.equal(p.state.playMusicInfo.musicInfo.id, 'd')
})
test('queue snapshots only apply to their source and reset notifications stop after unsubscribe', () => {
  const p = playback()
  let calls = 0
  const unsubscribe = p.queue.subscribePlaybackQueue(() => calls++)
  p.queue.moveQueueSong('saved', p.songs, 1, 2)
  assert.deepEqual(ids(p.queue.getPlaybackQueue('other', p.songs)), ids(p.songs))
  p.queue.moveQueueSong('saved', p.songs, -1, 2)
  assert.equal(calls, 1)
  p.queue.resetPlaybackQueue()
  assert.equal(calls, 2)
  unsubscribe()
  p.queue.resetPlaybackQueue()
  assert.equal(calls, 2)
})
const geometry = load('src/screens/PlayDetail/components/lyricLayout.ts')
test('lyric seeking handles variable heights, unmeasured virtualized rows and empty lyrics', () => {
  assert.equal(geometry.getLyricLineAtOffset(190, 100, [40, 80, 20], 3), 1)
  assert.equal(geometry.getLyricLineAtOffset(240, 100, [40, undefined, NaN, 80], 4), 2)
  assert.equal(geometry.getLyricLineAtOffset(999, 100, [], 3), 2)
  assert.equal(geometry.getLyricLineAtOffset(10, 100, [], 0), -1)
})

test('a subsequent check resets the previous latest flag and surfaces a newly published version', async() => {
  let latest = '1.10.1'
  const state = { versionInfo: { version: '1.10.1', isLatest: true, status: 'idle' }, showModal: false }
  let shown = 0
  const service = load('src/core/version.ts', {
    '@/utils': { compareVer: (a, b) => a === b ? 0 : a < b ? -1 : 1 },
    '@/utils/version': { getVersionInfo: async() => ({ version: latest, desc: '', history: [] }) },
    '@/store/version/action': { default: { setVersionInfo: info => Object.assign(state.versionInfo, info), setVisibleModal: value => { state.showModal = value } } },
    '@/store/version/state': { default: state },
    '@/utils/data': { getIgnoreVersion: async() => null }, '@/navigation': { showVersionModal: () => { shown++ } },
    'react-native-navigation': {}, '@/utils/tools': {},
  })
  await service.checkUpdate()
  assert.equal(state.versionInfo.isLatest, true)
  latest = '1.10.2'
  await service.checkUpdate()
  assert.equal(state.versionInfo.isLatest, false)
  assert.equal(state.versionInfo.newVersion.version, '1.10.2')
  assert.equal(shown, 1)
})

function lyricScroll() {
  let cursor = 0
  const slots = []
  const effects = []
  const cleanups = []
  const timers = new Map()
  let clock = 0
  let timerId = 0
  const schedule = (fn, ms = 0) => { const id = ++timerId; timers.set(id, { fn, time: clock + ms }); return id }
  const cancel = id => timers.delete(id)
  const changed = (old, next) => !old || next.some((value, index) => value !== old[index])
  const react = {
    useRef: value => { const i = cursor++; slots[i] ??= { current: value }; return slots[i] },
    useState: value => { const i = cursor++; slots[i] ??= { value }; return [slots[i].value, value => { slots[i].value = value }] },
    useCallback: (fn, deps) => { const i = cursor++; if (changed(slots[i]?.deps, deps)) slots[i] = { fn, deps }; return slots[i].fn },
    useEffect: (fn, deps) => { const i = cursor++; if (changed(slots[i]?.deps, deps)) { slots[i] = { deps }; effects.push(() => { cleanups[i]?.(); cleanups[i] = fn() }) } },
  }
  const seeks = []
  const hook = load('src/screens/PlayDetail/components/useLyricScroll.ts', {
    react, 'react-native': { AccessibilityInfo: { isReduceMotionEnabled: async() => false, addEventListener: () => ({ remove() {} }) } },
  }, { setTimeout: schedule, clearTimeout: cancel, requestAnimationFrame: schedule, cancelAnimationFrame: cancel, global: { app_event: { setProgress: time => seeks.push(time) } } })
  const commands = []
  const lines = Array.from({ length: 100 }, (_, i) => ({ text: String(i), time: i * 1000, extendedLyrics: [] }))
  let result
  const render = line => {
    cursor = 0
    result = hook.useLyricScroll(lines, line, false)
    result.flatListRef.current = { scrollToIndex: options => commands.push({ kind: 'index', ...options }), scrollToOffset: options => commands.push({ kind: 'offset', ...options }) }
    effects.splice(0).forEach(effect => effect())
    return result
  }
  const advance = ms => {
    const target = clock + ms
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.time <= target).sort((a, b) => a[1].time - b[1].time)[0]
      if (!next) break
      clock = next[1].time
      timers.delete(next[0])
      next[1].fn()
    }
    clock = target
  }
  return { render, commands, advance, timers, seeks, lines, cleanup: () => cleanups.forEach(cleanup => cleanup?.()) }
}
test('lyrics follow immediately through native animation and wait until momentum ends before resuming', () => {
  const h = lyricScroll()
  h.render(0)
  h.advance(0)
  h.commands.length = 0
  const scroll = h.render(1)
  assert.equal(h.commands.at(-1).index, 1)
  assert.equal(h.commands.at(-1).animated, true)
  scroll.scrollProps.onScrollBeginDrag()
  scroll.scrollProps.onScrollEndDrag()
  scroll.scrollProps.onMomentumScrollBegin()
  h.commands.length = 0
  h.render(2)
  h.advance(5000)
  assert.equal(h.commands.length, 0)
  scroll.scrollProps.onMomentumScrollEnd()
  h.advance(2499)
  assert.equal(h.commands.length, 0)
  h.advance(1)
  assert.equal(h.commands.at(-1).index, 2)
  h.cleanup()
})
test('unmeasured lyric retries are bounded, interrupted by dragging and cleared on unmount', () => {
  const h = lyricScroll()
  const scroll = h.render(50)
  h.advance(0)
  h.commands.length = 0
  for (let i = 0; i < 6; i++) {
    scroll.scrollProps.onScrollToIndexFailed({ index: 50, averageItemLength: 40 })
    h.advance(120)
  }
  assert.equal(h.commands.filter(command => command.kind === 'offset').length, 2)
  h.render(51)
  scroll.scrollProps.onScrollToIndexFailed({ index: 51, averageItemLength: 40 })
  scroll.scrollProps.onScrollBeginDrag()
  assert.equal(h.timers.size, 0)
  scroll.scrollProps.onScrollEndDrag()
  h.cleanup()
  assert.equal(h.timers.size, 0)
})

test('removing the normal queue anchor while a priority song plays resumes at the first remaining song', async() => {
  const p = playback()
  p.state.playMusicInfo = { musicInfo: song('later'), listId: 'other', isTempPlay: true }
  p.queue.removeQueueSong('saved', p.songs, 'a')
  p.state.playInfo.playerPlayIndex = -1
  assert.equal((await p.player.getNextPlayMusicInfo()).musicInfo.id, 'b')
  await p.player.playNext()
  assert.equal(p.state.playMusicInfo.musicInfo.id, 'b')
})

test('tapping a lyric seeks in seconds even when the drag progress overlay is disabled', () => {
  const h = lyricScroll()
  const scroll = h.render(0)
  h.advance(0)
  scroll.onSeekLine(42)
  assert.deepEqual(h.seeks, [42])
  scroll.onSeekLine(-1)
  scroll.onSeekLine(999)
  h.lines[1].time = NaN
  scroll.onSeekLine(1)
  assert.deepEqual(h.seeks, [42])
  h.cleanup()
})
test('dragging and momentum do not seek accidentally or let follow take over before release', () => {
  const h = lyricScroll()
  const scroll = h.render(1)
  h.advance(0)
  h.commands.length = 0
  scroll.scrollProps.onScrollBeginDrag()
  scroll.scrollProps.onMomentumScrollEnd()
  scroll.onSeekLine(40)
  h.render(2)
  h.advance(6000)
  assert.equal(h.commands.length, 0)
  assert.equal(h.seeks.length, 0)
  scroll.scrollProps.onScrollEndDrag()
  scroll.scrollProps.onMomentumScrollBegin()
  scroll.onSeekLine(40)
  h.advance(6000)
  assert.equal(h.seeks.length, 0)
  scroll.scrollProps.onMomentumScrollEnd()
  scroll.onSeekLine(40)
  assert.deepEqual(h.seeks, [40])
  assert.equal(h.timers.size, 0)
  h.cleanup()
})
test('seeking lyrics synchronizes the timed highlight and preserves paused playback', () => {
  const parserModule = { exports: {} }
  vm.runInNewContext(fs.readFileSync(require.resolve('lrc-file-parser'), 'utf8'), {
    module: parserModule,
    window: { requestAnimationFrame: () => 1, cancelAnimationFrame() {}, clearTimeout() {} },
  })
  const Lyric = parserModule.exports
  const callbacks = []
  const parser = new Lyric({ offset: 0, onPlay: (line, text) => callbacks.push({ line, text }) })
  parser.setLyric('[00:00.00]Start\n[00:10.00]Middle\n[00:20.00]End')
  const state = { isPlay: false }
  const core = load('src/core/lyric.ts', {
    '@/plugins/lyric': { play: time => parser.play(time), pause: () => parser.pause() },
    '@/core/desktopLyric': { playDesktopLyric: async() => {}, pauseDesktopLyric: async() => {} },
    '@/plugins/player': {}, '@/store/player/state': { default: state }, '@/store/setting/state': {}, '@/plugins/player/utils': {},
  })
  core.seek(10.1)
  assert.equal(callbacks.at(-1).text, 'Middle')
  assert.equal(parser.isPlay, false)
  assert.equal(state.isPlay, false)
  state.isPlay = true
  core.seek(0.1)
  assert.equal(callbacks.at(-1).text, 'Start')
  assert.equal(parser.isPlay, true)
  parser.pause()
  const count = callbacks.length
  core.seek(NaN)
  core.seek(-1)
  assert.equal(callbacks.length, count)
})
function progressService(nativeSeek = async() => {}) {
  const events = new Map()
  const native = []
  const lyrics = []
  const positions = []
  const state = { musicInfo: { id: 'song' }, progress: { maxPlayTime: 30 }, isPlay: false }
  const init = load('src/core/init/player/playProgress.ts', {
    '@/core/list': {}, '@/core/player/progress': { setNowPlayTime: time => positions.push(time), setMaxplayTime() {} },
    '@/plugins/player': { setCurrentTime: time => { native.push(time); return nativeSeek(time) }, getPosition: async() => 4 },
    '@/utils/common': {}, '@/utils/data': {}, '@/utils/tools': { throttleBackgroundTimer: () => () => {} },
    'react-native-background-timer': {}, '@/store/player/state': { default: state }, '@/store/setting/state': {},
    '@/utils/nativeModules/utils': { onScreenStateChange() {} }, 'react-native': { AppState: { addEventListener() {} } },
    '@/core/lyric': { seek: time => lyrics.push(time) },
  }, { global: { app_event: { on: (name, callback) => events.set(name, callback) }, state_event: { on() {} } } })
  init.default()
  return { seek: events.get('setProgress'), native, lyrics, positions, state }
}
test('lyric progress requests clamp to track duration and update audio and lyrics together', () => {
  const service = progressService()
  service.seek(10)
  service.seek(100)
  service.seek(-3)
  service.seek(NaN)
  assert.deepEqual(service.native, [10, 30, 0])
  assert.deepEqual(service.lyrics, [10, 30, 0])
  assert.deepEqual(service.positions, [10, 30, 0])
  assert.equal(service.state.isPlay, false)
})
test('a failed seek restores the native position; an older failure cannot override a newer seek', async() => {
  const tick = () => new Promise(resolve => setImmediate(resolve))
  const failure = progressService(async() => { throw new Error('Seek failed') })
  failure.seek(10)
  await tick()
  assert.deepEqual(failure.positions, [10, 4])
  assert.deepEqual(failure.lyrics, [10, 4])
  let fail
  const racing = progressService(time => time === 10 ? new Promise((_resolve, reject) => { fail = reject }) : Promise.resolve())
  racing.seek(10)
  racing.seek(20)
  fail(new Error('Older seek failed'))
  await tick()
  assert.deepEqual(racing.positions, [10, 20])
  assert.deepEqual(racing.lyrics, [10, 20])
})

const flush = () => new Promise(resolve => setImmediate(resolve))
function fakeTimeouts() {
  let clock = 0
  let id = 0
  const tasks = new Map()
  return {
    setTimeout(fn, ms) { tasks.set(++id, { fn, time: clock + ms }); return id },
    clearTimeout(id) { tasks.delete(id) },
    advance(ms) {
      clock += ms
      for (const [id, task] of [...tasks]) if (task.time <= clock && tasks.has(id)) { tasks.delete(id); task.fn() }
    },
    count: () => tasks.size,
  }
}
function playbackErrors({ position = async() => 12, refresh = async() => {} } = {}) {
  const listeners = {}
  const timer = fakeTimeouts()
  const guard = load('src/core/player/urlRefreshGuard.ts')
  const music = song('broken')
  const state = { isPlay: false, musicInfo: { id: music.id }, playMusicInfo: { musicInfo: music } }
  const calls = { positions: 0, urls: 0, stops: 0, skips: 0, progress: [], status: [] }
  const appEvent = { on(name, fn) { listeners[name] = fn }, error() { state.isPlay = false } }
  load('src/core/init/player/playerEvent.ts', {
    '@/core/player/player': { clearFailedMusic() {}, setMusicUrl: async() => { calls.urls++; await refresh() }, skipFailedMusic: async() => { calls.skips++ } },
    '@/core/player/urlRefreshGuard': guard,
    '@/core/player/playStatus': { setStatusText: value => calls.status.push(value) },
    '@/plugins/player': { getPosition: async() => { calls.positions++; return position() }, isEmpty: () => false, setStop: async() => { calls.stops++; state.isPlay = false; listeners.playerEmptied() } },
    '@/utils/tools': { isActive: () => true }, 'react-native-background-timer': { default: timer },
    '@/store/player/state': { default: state }, '@/core/player/progress': { setNowPlayTime: value => calls.progress.push(value) },
  }, { global: { app_event: appEvent, lx: {}, i18n: { t: key => key } } }).default()
  const emit = name => {
    if (name === 'playerError') state.isPlay = false
    if (name === 'playerPlaying') state.isPlay = true
    listeners[name]()
  }
  return { timer, guard, state, calls, emit }
}
test('duplicate native errors reserve one refresh before asynchronous position and URL requests finish', async() => {
  let resolvePosition
  let resolveRefresh
  const p = playbackErrors({ position: () => new Promise(resolve => { resolvePosition = resolve }), refresh: () => new Promise(resolve => { resolveRefresh = resolve }) })
  p.emit('playerError'); p.emit('playerError'); p.emit('playerError')
  assert.equal(p.calls.positions, 1)
  resolvePosition(0)
  await flush()
  assert.equal(p.calls.urls, 1)
  assert.deepEqual(p.calls.progress, [0])
  p.emit('playerError')
  assert.equal(p.calls.positions, 1)
  resolveRefresh()
  await flush()
  p.emit('playerError')
  assert.equal(p.calls.positions, 2)
})
test('two refreshes exhaust the budget even with brief Playing/Emptied events; one delayed skip follows', async() => {
  const p = playbackErrors()
  for (let i = 0; i < 2; i++) {
    p.emit('playerError'); await flush()
    p.emit('playerPlaying'); p.emit('playerEmptied')
  }
  p.emit('playerError'); p.emit('playerError'); await flush()
  assert.equal(p.calls.urls, 2)
  assert.equal(p.calls.stops, 1)
  p.timer.advance(5000); await flush()
  assert.equal(p.calls.skips, 1)
  p.emit('playerError'); await flush()
  assert.equal(p.calls.urls, 2)
})
test('failed position lookup still refreshes; switching songs invalidates pending refresh callbacks', async() => {
  const p = playbackErrors({ position: async() => { throw new Error('no native position') } })
  p.emit('playerError'); await flush()
  assert.equal(p.calls.urls, 1)
  assert.equal(p.calls.progress.length, 0)
  let resolvePosition
  const pending = playbackErrors({ position: () => new Promise(resolve => { resolvePosition = resolve }) })
  pending.emit('playerError'); await flush()
  pending.state.playMusicInfo.musicInfo = song('new')
  pending.emit('musicToggled')
  resolvePosition(45); await flush()
  assert.equal(pending.calls.urls, 0)
  assert.equal(pending.calls.progress.length, 0)
})
test('loading timeouts share the refresh budget and pause the state before requesting a URL', async() => {
  let p
  p = playbackErrors({ refresh: async() => assert.equal(p.state.isPlay, false) })
  for (let i = 0; i < 3; i++) {
    p.state.isPlay = true
    p.emit('playerLoadstart')
    p.timer.advance(25000); await flush()
  }
  assert.equal(p.calls.urls, 2)
  assert.equal(p.calls.stops, 1)
  p.timer.advance(5000); await flush()
  assert.equal(p.calls.skips, 1)
})
test('sustained playback grants a fresh retry budget; manual reset invalidates old tokens', async() => {
  const p = playbackErrors()
  p.emit('playerError'); await flush()
  p.emit('playerError'); await flush()
  p.emit('playerPlaying')
  p.timer.advance(5000)
  p.emit('playerError'); await flush()
  assert.equal(p.calls.urls, 3)
  const guard = load('src/core/player/urlRefreshGuard.ts').createUrlRefreshGuard()
  const old = guard.reserve()
  guard.reset()
  const current = guard.reserve()
  guard.finish(old)
  assert.equal(guard.busy(), true)
  assert.equal(guard.isCurrent(old), false)
  guard.finish(current)
  assert.equal(guard.busy(), false)
})
test('a consistently rate-limited source makes only three requests and then stops retrying', async() => {
  const timer = fakeTimeouts()
  let requests = 0
  const p = playback({ timer, globals: { setTimeout: timer.setTimeout, clearTimeout: timer.clearTimeout, console: { log() {}, warn() {} } }, music: { getMusicUrl: async() => { requests++; throw new Error('rate limited') } } })
  const pending = p.player.setMusicUrl(p.state.playMusicInfo.musicInfo)
  await flush()
  assert.equal(requests, 1)
  timer.advance(2000); await flush()
  assert.equal(requests, 2)
  timer.advance(2000); await pending
  assert.equal(requests, 3)
  assert.equal(p.statuses.at(-1), 'rate limited')
  assert.equal(timer.count(), 1) // Delayed failure skip, not another URL retry.
  timer.advance(5000); await flush()
  assert.equal(requests, 3)
  assert.equal(timer.count(), 0)
})
test('an older URL result cannot play or clear the new request state after switching songs', async() => {
  const timer = fakeTimeouts()
  const resolvers = []
  const resources = []
  const p = playback({ timer, music: { getMusicUrl: () => new Promise(resolve => resolvers.push(resolve)) }, native: { setResource: (...args) => resources.push(args) } })
  const old = p.player.setMusicUrl(p.songs[1])
  await flush()
  p.state.playMusicInfo.musicInfo = p.songs[2]
  const current = p.player.setMusicUrl(p.songs[2])
  await flush()
  resolvers[0]('old-url'); await old
  assert.equal(resources.length, 0)
  assert.equal(timer.count(), 1)
  resolvers[1]('new-url'); await current
  assert.equal(resources.length, 1)
  assert.equal(resources[0][1], 'new-url')
  assert.equal(timer.count(), 0)
})
test('a failed single-song loop stops instead of restarting; manually retrying is still allowed', async() => {
  const p = playback()
  p.settings.setting['player.togglePlayMethod'] = 'singleLoop'
  await p.player.skipFailedMusic()
  assert.equal(p.stops(), 1)
  assert.equal(p.state.playMusicInfo.musicInfo.id, 'b')
  assert.equal(p.statuses.at(-1), 'player__error')
  assert.equal(p.guard.urlRefreshGuard.busy(), true)
  await p.player.playList('saved', 1)
  assert.equal(p.guard.urlRefreshGuard.busy(), false)
})
test('consecutive failures traverse a loop at most once, then stop before returning to the first song', async() => {
  const p = playback()
  for (const expected of ['c', 'd', 'a', 'a']) {
    await p.player.skipFailedMusic()
    assert.equal(p.state.playMusicInfo.musicInfo.id, expected)
  }
  assert.equal(p.statuses.at(-1), 'player__error')
  assert.equal(p.stops(), 4)
})

test('programmatic native stop does not emit song completion; a new active track restores natural completion', async() => {
  const intent = load('src/plugins/player/stopIntent.ts')
  const listeners = {}
  const global = { lx: { playerTrackId: 'song__//audio', playerStatus: {} }, app_event: {} }
  let currentTrackId = global.lx.playerTrackId
  let ended = 0
  let emptied = 0
  let skips = 0
  Object.assign(global.app_event, { playerPause() {}, pause() {}, playerEnded() { ended++ }, playerEmptied() { emptied++ } })
  const trackPlayer = { stop: async() => assert.equal(intent.isManualStop(), true), skipToNext: async() => { skips++ }, pause: async() => {}, addEventListener(name, fn) { listeners[name] = fn }, registerPlaybackService(factory) { void factory()() } }
  const utils = load('src/plugins/player/utils.ts', {
    'react-native-track-player': { default: trackPlayer }, 'react-native-background-timer': {},
    './playList': {}, '@/utils/fs': {}, '@/utils/tools': {}, './hook': {}, './stopIntent': intent,
  }, { global })
  load('src/plugins/player/service.ts', {
    'react-native-track-player': { default: trackPlayer, Event: { PlaybackTrackChanged: 'track-changed' } },
    './utils': utils, './stopIntent': intent, './playList': { getCurrentTrackId: async() => currentTrackId },
    '@/core/common': {}, '@/core/player/player': {},
  }, { global }).default()
  await utils.setStop()
  assert.equal(skips, 1)
  currentTrackId = 'song__//default'
  await listeners['track-changed']({ track: 0 })
  assert.equal(ended, 0)
  assert.equal(emptied, 1)
  currentTrackId = 'next__//audio'
  await listeners['track-changed']({ track: null })
  assert.equal(intent.isManualStop(), false)
  currentTrackId = 'next__//default'
  await listeners['track-changed']({ track: 0 })
  assert.equal(ended, 1)
  assert.equal(emptied, 2)
})
test('native completion during error recovery cannot bypass the retry budget or auto-restart a failed song', async() => {
  const guard = load('src/core/player/urlRefreshGuard.ts')
  const listeners = {}
  let next = 0
  let seeks = 0
  await load('src/core/init/player/player.ts', {
    '@/core/player/playedList': {}, '@/core/player/player': { playNext: async() => { next++ } },
    '@/core/player/playStatus': { setStatusText() {} }, '@/plugins/player': {}, '@/plugins/player/playList': {},
    '@/store/player/state': { default: {} }, '@/store/setting/state': { default: {} }, '@/core/player/urlRefreshGuard': guard,
  }, { global: { lx: {}, i18n: { t: key => key }, app_event: { on(name, fn) { listeners[name] = fn }, setProgress() { seeks++ } }, state_event: { on() {} } } }).default({})
  const token = guard.urlRefreshGuard.reserve()
  listeners.playerEnded()
  guard.urlRefreshGuard.finish(token)
  guard.urlRefreshGuard.fail()
  listeners.playerEnded()
  assert.equal(next, 0)
  assert.equal(seeks, 0)
  guard.urlRefreshGuard.reset()
  listeners.playerEnded()
  assert.equal(next, 1)
  assert.equal(seeks, 1)
})
test('a hung URL request cannot start playback after its loading timeout stops a failed single-song loop', async() => {
  const timer = fakeTimeouts()
  let resolveUrl
  const resources = []
  const p = playback({ timer, music: { getMusicUrl: () => new Promise(resolve => { resolveUrl = resolve }) }, native: { setResource: (...args) => resources.push(args) } })
  p.settings.setting['player.togglePlayMethod'] = 'singleLoop'
  const pending = p.player.setMusicUrl(p.state.playMusicInfo.musicInfo)
  await flush()
  timer.advance(100000); await flush()
  assert.equal(p.stops(), 1)
  assert.equal(p.statuses.at(-1), 'player__error')
  resolveUrl('too-late-url'); await pending
  assert.equal(resources.length, 0)
  assert.equal(timer.count(), 0)
})
