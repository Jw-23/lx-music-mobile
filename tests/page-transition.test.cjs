const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { EventEmitter } = require('node:events')
function harness(file, imports = {}, globals = {}) {
  const cells = []; let cursor = 0; let effects = []; let dirty = false; let reduced = false; let width = 390
  const running = []
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index])
  const react = {
    useRef(value) { const i = cursor++; cells[i] ||= { current: value }; return cells[i] },
    useState(value) { const i = cursor++; if (!(i in cells)) cells[i] = value; return [cells[i], value => { const next = typeof value === 'function' ? value(cells[i]) : value; if (!Object.is(next, cells[i])) { cells[i] = next; dirty = true } }] },
    useMemo(fn, deps) { const i = cursor++; if (!same(cells[i]?.deps, deps)) cells[i] = { value: fn(), deps }; return cells[i].value },
    useLayoutEffect(fn, deps) { const i = cursor++; if (!same(cells[i]?.deps, deps)) effects.push(() => { cells[i]?.cleanup?.(); cells[i] = { deps, cleanup: fn() } }) },
    forwardRef: fn => fn,
  }
  react.useEffect = react.useLayoutEffect
  react.useCallback = (fn, deps) => react.useMemo(() => fn, deps)
  react.useImperativeHandle = (ref, fn, deps) => react.useLayoutEffect(() => { ref.current = fn(); return () => { ref.current = null } }, deps)
  const jsx = (type, props, key) => ({ type, props, key })
  const animate = (value, config, children) => ({ value, config, children, stopped: false, start(done) { this.done = done; running.push(this) }, stop() { this.stopped = true }, finish() { if (this.value) this.value.setValue(this.config.toValue); this.children?.forEach(child => child.value.setValue(child.config.toValue)); this.done?.({ finished: true }) } })
  const native = {
    View: 'View', ScrollView: 'ScrollView', Pressable: 'Pressable', ActivityIndicator: 'Spinner', Keyboard: { dismiss() {} },
    StyleSheet: { create: value => value, absoluteFill: {} }, useWindowDimensions: () => ({ width }),
    Easing: { cubic: 'cubic', out: value => value, bezier: (...args) => args },
    Animated: { View: 'AnimatedView', Value: class { constructor(value) { this.value = value } setValue(value) { this.value = value } interpolate(config) { return { value: this, config } } }, timing: (value, config) => animate(value, config), parallel: children => animate(null, null, children) },
  }
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  vm.runInNewContext(outputText, { exports, console, ...globals, require(name) {
    const available = { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native, '@/utils/hooks/useReducedMotion': { default: () => reduced }, '@/theme/design': { useDesignColors: () => ({ background: 'white', accent: 'red', secondarySurface: 'gray' }) }, ...imports }
    if (!(name in available)) throw new Error(`Unexpected import ${name}`)
    return available[name]
  } }, { filename: file })
  let props = {}; let tree; let component = exports.default
  const render = (patch = {}, ref) => {
    props = { ...props, ...patch }
    let attempts = 0
    do {
      dirty = false; cursor = 0; effects = []; tree = component(props, ref)
      effects.forEach(fn => fn())
      if (++attempts > 20) throw new Error('Render loop')
    } while (dirty)
    return tree
  }
  return { render, mount: child => { cells.forEach(cell => cell?.cleanup?.()); cells.length = 0; component = child; props = {}; return render() }, tree: () => tree, running, reduce: value => { reduced = value }, resize: value => { width = value }, cleanup: () => cells.forEach(cell => cell?.cleanup?.()) }
}
test('tab transitions skip the initial render, reveal in the chosen direction and stop on interruption', () => {
  const h = harness('src/components/common/PageTransition.tsx')
  h.render({ transitionKey: 'search', children: 'content' }); assert.equal(h.running.length, 0)
  h.render({ transitionKey: 'library', direction: 1 }); const first = h.running.at(-1)
  assert.equal(h.tree().props.style.transform[0].translateX.value, 12)
  assert.equal(h.tree().props.style.opacity.value, 0.88)
  h.render({ transitionKey: 'search', direction: -1 }); assert.equal(first.stopped, true)
  assert.equal(h.tree().props.style.transform[0].translateX.value, -12)
  h.running.at(-1).finish(); assert.equal(h.tree().props.style.transform[0].translateX.value, 0)
  h.cleanup(); assert.equal(h.running.at(-1).stopped, true)
})
test('native pager motion and reduced-motion changes cancel the tab reveal and restore visible content', () => {
  const h = harness('src/components/common/PageTransition.tsx')
  h.render({ transitionKey: 'search' }); h.render({ transitionKey: 'list' })
  const moving = h.running.at(-1); h.render({ enabled: false })
  assert.equal(moving.stopped, true); assert.equal(h.tree().props.style.opacity.value, 1)
  h.render({ transitionKey: 'top' }); assert.equal(h.running.length, 1)
  h.render({ transitionKey: 'settings', enabled: true }); h.reduce(true); h.render()
  assert.equal(h.running.at(-1).stopped, true); assert.equal(h.tree().props.style.opacity.value, 1)
  h.render({ transitionKey: 'search' }); assert.equal(h.running.length, 2)
})
test('settings push and pop retain both levels until completion and expose only the interactive level', () => {
  const root = { type: 'SettingsList', props: { scrollOffset: 300 } }; const detail = { type: 'BasicSettings' }
  const h = harness('src/components/common/StackTransition.tsx')
  h.render({ children: root, detail: null }); h.running.at(-1).finish()
  h.render({ detailKey: 'basic', detail }); assert.equal(h.tree().props.children[0].props.children, root)
  assert.equal(h.tree().props.children[0].props.pointerEvents, 'none'); assert.equal(h.tree().props.children[0].props.importantForAccessibility, 'no-hide-descendants')
  assert.equal(h.tree().props.children[1].props.children, detail); h.running.at(-1).finish()
  h.render({ detailKey: undefined, detail: null })
  assert.equal(h.tree().props.children[1].props.children, detail); assert.equal(h.tree().props.children[1].props.pointerEvents, 'none')
  h.running.at(-1).finish(); h.render()
  assert.equal(h.tree().props.children[1], null); assert.equal(h.tree().props.children[0].props.pointerEvents, 'auto'); assert.equal(h.tree().props.children[0].props.children, root)
})
test('an interrupted settings pop cannot hide a newer detail or clear it after unmount', () => {
  const h = harness('src/components/common/StackTransition.tsx')
  h.render({ children: 'root', detailKey: 'basic', detail: 'basic' }); h.running.at(-1).finish()
  h.render({ detailKey: undefined, detail: null }); const pop = h.running.at(-1)
  h.render({ detailKey: 'player', detail: 'player' }); pop.finish(); h.render()
  assert.equal(pop.stopped, true); assert.equal(h.tree().props.children[1].props.children, 'player')
  h.render({ detailKey: undefined, detail: null }); const last = h.running.at(-1); h.cleanup(); last.finish(); h.render()
  assert.ok(h.tree().props.children[1]); assert.equal(last.stopped, true)
})
test('reduced motion completes settings navigation immediately; rotation updates the slide width', () => {
  const h = harness('src/components/common/StackTransition.tsx'); h.reduce(true)
  h.render({ children: 'root', detailKey: 'basic', detail: 'basic' }); assert.equal(h.running.length, 0)
  h.resize(844); h.render()
  assert.equal(h.tree().props.children[1].props.style[1].transform[0].translateX.config.outputRange[0], 844)
  h.render({ detailKey: undefined, detail: null }); assert.equal(h.tree().props.children[1], null)
})
test('vertical navigation separates a native swipe from a tab tap without traversing intermediate tabs', () => {
  const event = new EventEmitter(); const state = { navActiveId: 'nav_search' }; const pages = []
  const setNavActiveId = id => { state.navActiveId = id; event.emit('navActiveIdUpdated', id) }
  const h = harness('src/screens/Home/Vertical/Main.tsx', {
    '../Views/Search': { default: 'Search' }, '../Views/SongList': { default: 'SongList' }, '../Views/Mylist': { default: 'Mylist' }, '../Views/Leaderboard': { default: 'Leaderboard' }, '../Views/Setting': { default: 'Setting' },
    '@/store/common/state': { default: state }, '@/store/setting/state': { default: { setting: { 'common.homePageScroll': true } } },
    '@/utils/tools': { createStyle: value => value }, 'react-native-pager-view': { default: 'Pager' },
    '@/core/common': { setNavActiveId }, '@/components/common/PageTransition': { default: 'PageTransition' },
  }, { global: { state_event: event, lx: { homePagerIdle: true } } })
  h.render(); let pager = h.tree().props.children; pager.props.ref.current = { setPageWithoutAnimation: index => pages.push(index) }
  pager.props.onPageScrollStateChanged({ nativeEvent: { pageScrollState: 'dragging' } })
  pager.props.onPageSelected({ nativeEvent: { position: 1 } }); h.render()
  assert.equal(state.navActiveId, 'nav_songlist'); assert.equal(h.tree().props.transitionKey, 'nav_search'); assert.equal(h.tree().props.enabled, false); assert.deepEqual(pages, [])
  setNavActiveId('nav_setting'); h.render()
  assert.equal(h.tree().props.transitionKey, 'nav_setting:1'); assert.equal(h.tree().props.direction, 1); assert.equal(h.tree().props.enabled, true); assert.deepEqual(pages, [4])
  pager = h.tree().props.children; pager.props.onPageSelected({ nativeEvent: { position: 4 } }); h.render(); assert.deepEqual(pages, [4])
  setNavActiveId('nav_search'); h.render(); assert.equal(h.tree().props.direction, -1); assert.deepEqual(pages, [4, 0])
  pager.props.onPageSelected({ nativeEvent: { position: 4 } }); h.render(); assert.equal(state.navActiveId, 'nav_search')
  pager.props.onPageSelected({ nativeEvent: { position: 0 } }); h.render()
  pager.props.onPageScrollStateChanged({ nativeEvent: { pageScrollState: 'dragging' } }); pager.props.onPageSelected({ nativeEvent: { position: 1 } }); h.render()
  setNavActiveId('nav_search'); h.render(); assert.equal(h.tree().props.transitionKey, 'nav_search:3'); assert.equal(h.tree().props.enabled, true)
  h.cleanup(); assert.equal(event.listenerCount('navActiveIdUpdated'), 0)
})
const nodes = tree => { const found = []; const walk = value => { if (!value || typeof value !== 'object') return; if (Array.isArray(value)) return value.forEach(walk); found.push(value); walk(value.props?.children) }; walk(tree); return found }
test('the real import panel retains a failed link, offers retry and requires a separate action to activate', async() => {
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src/screens/Home/Views/Setting/settings/Basic/UserApiEditModal/importFlow.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } })
  const flow = {}; vm.runInNewContext(outputText, { exports: flow, Error })
  const list = []; const used = []; let fail = true; let saves = 0
  const h = harness('src/screens/Home/Views/Setting/settings/Basic/UserApiEditModal/ImportBtn.tsx', {
    '@/components/common/Text': { default: 'Text' }, '@/components/common/Input': { default: 'Input' }, '@/components/common/Button': { default: 'Button' }, '@/components/common/ChoosePath': { default: 'ChoosePath' }, '@/components/common/Icon': { Icon: 'Icon' },
    '@/config/constant': { USER_API_SOURCE_FILE_EXT_RXP: ['js'] }, '@/lang': { useI18n: () => key => key },
    '@/store/userApi': { state: { list }, useUserApiList: () => list }, '@/store/setting/hook': { useSettingValue: () => used.at(-1) },
    '@/core/userApi': { importUserApi: async() => { saves++; const info = { id: 'new', name: 'Source' }; list.push(info); return info } }, '@/core/apiSource': { setApiSource: id => used.push(id) },
    '@/utils/fs': { readFile: async() => '' }, '@/utils/request': { httpFetch: () => ({ promise: fail ? Promise.reject(new Error('offline')) : Promise.resolve({ statusCode: 200, body: '/* @name Source */ script' }), cancelHttp() {} }) }, './importFlow': flow,
  })
  const ref = { current: null }; h.render({}, ref)
  nodes(h.tree()).filter(node => node.type === 'Pressable')[1].props.onPress(); h.render({}, ref)
  const link = 'https://example.com/source.js'; nodes(h.tree()).find(node => node.type === 'Input').props.onChangeText(link); h.render({}, ref)
  nodes(h.tree()).find(node => node.type === 'Button').props.onPress(); await new Promise(resolve => setImmediate(resolve)); h.render({}, ref)
  assert.equal(nodes(h.tree()).find(node => node.type === 'Input').props.value, link); assert.ok(nodes(h.tree()).find(node => node.props?.accessibilityRole === 'alert')); assert.equal(saves, 0)
  fail = false; nodes(h.tree()).find(node => node.type === 'Button').props.onPress(); await new Promise(resolve => setImmediate(resolve)); h.render({}, ref)
  assert.equal(saves, 1); assert.deepEqual(used, [])
  nodes(h.tree()).filter(node => node.type === 'Button')[1].props.onPress(); h.render({}, ref)
  assert.deepEqual(used, ['new']); assert.equal(nodes(h.tree()).filter(node => node.type === 'Button')[1].props.disabled, true)
  h.cleanup(); assert.equal(ref.current, null)
})

test('neighbor pages render before the first swipe and reappear immediately after settings invalidates them', () => {
  const event = new EventEmitter(); const state = { navActiveId: 'nav_search' }
  const h = harness('src/screens/Home/Vertical/Main.tsx', {
    '../Views/Search': { default: 'Search' }, '../Views/SongList': { default: 'SongList' }, '../Views/Mylist': { default: 'Mylist' }, '../Views/Leaderboard': { default: 'Leaderboard' }, '../Views/Setting': { default: 'Setting' },
    '@/store/common/state': { default: state }, '@/store/setting/state': { default: { setting: { 'common.homePageScroll': true } } }, '@/utils/tools': { createStyle: value => value }, 'react-native-pager-view': { default: 'Pager' }, '@/core/common': {}, '@/components/common/PageTransition': { default: 'PageTransition' },
  }, { global: { state_event: event } })
  h.render(); const pages = h.tree().props.children.props.children
  assert.equal(h.mount(pages[1].props.children.type).type, 'SongList')
  assert.equal(h.mount(pages[2].props.children.type), null)
  state.navActiveId = 'nav_songlist'; event.emit('navActiveIdUpdated', state.navActiveId); assert.equal(h.render().type, 'Leaderboard')
  state.navActiveId = 'nav_setting'; event.emit('navActiveIdUpdated', state.navActiveId); event.emit('themeUpdated'); assert.equal(h.render(), null)
  state.navActiveId = 'nav_songlist'; event.emit('navActiveIdUpdated', state.navActiveId); assert.equal(h.render().type, 'Leaderboard')
  h.cleanup(); assert.equal(event.listenerCount('navActiveIdUpdated'), 0)
})
