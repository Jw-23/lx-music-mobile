const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const vm = require('node:vm')
const { execFileSync } = require('node:child_process')
const ts = require('typescript')
function load(file, imports = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } })
  const exports = {}
  vm.runInNewContext(outputText, { exports, ...globals, require(name) {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`)
    return imports[name]
  } })
  return exports
}
const remote = load('src/core/player/tvRemoteActions.ts')
test('TV detection accepts Android TV, the native device flag and a manual box setting, without changing other platforms', () => {
  for (const [OS, platformTV, nativeTV, forced, expected] of [
    ['android', false, false, false, false], ['android', true, false, false, true], ['android', false, true, false, true],
    ['android', false, false, true, true], ['ios', true, true, true, false],
  ]) {
    const hook = load('src/utils/hooks/useTVMode.ts', {
      'react-native': { Platform: { OS, isTV: platformTV }, NativeModules: { UtilsModule: { isTV: nativeTV } } }, '@/store/setting/hook': { useSettingValue: () => forced },
    })
    assert.equal(hook.default(), expected)
  }
})
test('remote seeking stays in seconds, clamps both boundaries, and refuses missing or invalid durations', () => {
  assert.equal(remote.seekTVPosition(30, 100, 1), 40)
  assert.equal(remote.seekTVPosition(30, 100, -1), 20)
  assert.equal(remote.seekTVPosition(3, 100, -1), 0)
  assert.equal(remote.seekTVPosition(99, 100, 1), 100)
  for (const [position, duration] of [[0, 0], [5, NaN], [NaN, 100], [Infinity, 100]]) assert.equal(remote.seekTVPosition(position, duration, 1), null)
})
function player() {
  const state = { id: 'song', position: 25, duration: 60 }; const calls = []
  const handle = remote.createTVRemoteHandler({ current: () => state,
    play: () => calls.push('play'), pause: async() => { calls.push('pause') }, toggle: () => calls.push('toggle'),
    next: async() => { calls.push('next') }, previous: async() => { calls.push('previous') }, seek: time => calls.push(['seek', time]),
  })
  return { handle, calls, state }
}
test('dedicated play and pause stay distinct from toggle; next, previous and seeking use the current player state', async() => {
  const h = player()
  for (const action of ['play', 'pause', 'toggle', 'next', 'previous', 'forward', 'rewind']) assert.equal(await h.handle(action), true)
  assert.deepEqual(h.calls, ['play', 'pause', 'toggle', 'next', 'previous', ['seek', 35], ['seek', 15]])
  h.state.position = 59; await h.handle('forward'); assert.deepEqual(h.calls.at(-1), ['seek', 60])
})
test('an empty player, unrelated keys and unknown duration do not start or seek a song', async() => {
  const h = player(); h.state.id = null
  for (const action of ['play', 'pause', 'toggle', 'next', 'previous', 'forward', 'rewind']) assert.equal(await h.handle(action), false)
  h.state.id = 'song'; h.state.duration = 0
  assert.equal(await h.handle('forward'), false); assert.equal(await h.handle('volumeUp'), false); assert.equal(await h.handle(null), false)
  assert.deepEqual(h.calls, [])
})
test('remote input is registered once for the app and playback errors are handled instead of escaping the native callback', async() => {
  let registrations = 0; let listener; const warnings = []
  const state = { musicInfo: { id: 'song' }, progress: { nowPlayTime: 10, maxPlayTime: 100 } }
  const init = load('src/core/init/tvRemote.ts', {
    'react-native': { Platform: { OS: 'android' }, NativeModules: { UtilsModule: {} }, NativeEventEmitter: class { addListener(name, callback) { assert.equal(name, 'tv-remote-action'); registrations++; listener = callback } } },
    '@/core/player/player': { playNext: async() => { throw new Error('no URL') } }, '@/store/player/state': { default: state },
    '@/core/player/tvRemoteActions': remote, '@/utils/log': { log: { warn: message => warnings.push(message) } },
  }, { Error }).default
  init(); init(); assert.equal(registrations, 1)
  listener({ action: 'next' }); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(warnings, ['no URL'])
})
test('native key policy acts on one uncancelled release, keeps ordinary directions and system keys unhandled, and supports queue adjustment', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'lx-tv-jvm-'))
  const source = path.join(__dirname, '..', 'android/app/src/main/java/cn/toside/music/mobile/tv/TvKeyPolicy.java')
  const java = name => process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', name) : name
  const main = path.join(folder, 'TvRemotePolicyTest.java')
  fs.writeFileSync(main, `import cn.toside.music.mobile.tv.TvKeyPolicy;
public class TvRemotePolicyTest {
  static void check(boolean value) { if (!value) throw new AssertionError(); }
  public static void main(String[] args) {
    int[] keys = {85,79,126,127,86,87,88,89,90};
    String[] actions = {"toggle","toggle","play","pause","pause","next","previous","rewind","forward"};
    for (int i=0;i<keys.length;i++) check(actions[i].equals(TvKeyPolicy.mediaAction(keys[i])));
    for (int key:new int[]{3,4,19,20,21,22,23,24,25,66}) check(TvKeyPolicy.mediaAction(key)==null);
    check(!TvKeyPolicy.activateOnRelease(0,false)); check(!TvKeyPolicy.activateOnRelease(2,false));
    check(!TvKeyPolicy.activateOnRelease(1,true)); check(TvKeyPolicy.activateOnRelease(1,false));
    for (int key:new int[]{23,66,160}) check(TvKeyPolicy.isConfirm(key));
    check(!TvKeyPolicy.isConfirm(4)); check(TvKeyPolicy.adjustment(19)==-1); check(TvKeyPolicy.adjustment(21)==-1);
    check(TvKeyPolicy.adjustment(20)==1); check(TvKeyPolicy.adjustment(22)==1); check(TvKeyPolicy.adjustment(4)==0);
  }
}`)
  try {
    execFileSync(java('javac'), ['-d', folder, source, main], { stdio: 'pipe' })
    execFileSync(java('java'), ['-cp', folder, 'TvRemotePolicyTest'], { stdio: 'pipe' })
  } finally { fs.rmSync(folder, { recursive: true, force: true }) }
})
