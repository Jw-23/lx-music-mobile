const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { EventEmitter } = require('node:events')
function pure(file) {
  const exports = {}
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
  vm.runInNewContext(outputText, { exports })
  return exports
}
const navigation = pure('src/config/homeTabs.ts')
function nodes(tree) {
  const result = []
  const visit = node => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(visit); result.push(node); visit(node.props?.children); visit(node.props?.ListHeaderComponent) }
  visit(tree); return result
}
function harness(file, imports = {}, globals = {}) {
  const cells = []; let cursor = 0; let effects = []; let dirty = false; let reduced = false; let width = 390
  const running = []
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index])
  const react = {
    useRef(value) { const i = cursor++; cells[i] ||= { current: value }; return cells[i] },
    useState(value) { const i = cursor++; if (!(i in cells)) cells[i] = value; return [cells[i], value => { const next = typeof value === 'function' ? value(cells[i]) : value; if (!Object.is(next, cells[i])) { cells[i] = next; dirty = true } }] },
    useMemo(fn, deps) { const i = cursor++; if (!same(cells[i]?.deps, deps)) cells[i] = { value: fn(), deps }; return cells[i].value },
    useLayoutEffect(fn, deps) { const i = cursor++; if (!same(cells[i]?.deps, deps)) effects.push(() => { cells[i]?.cleanup?.(); cells[i] = { deps, cleanup: fn() } }) },
    forwardRef: fn => fn, memo: fn => fn, createContext: value => ({ value, Provider: 'Provider' }), useContext: context => context.value,
  }
  react.useEffect = react.useLayoutEffect
  react.useCallback = (fn, deps) => react.useMemo(() => fn, deps)
  react.useImperativeHandle = (ref, fn, deps) => react.useLayoutEffect(() => { ref.current = fn(); return () => { ref.current = null } }, deps)
  const jsx = (type, props, key) => ({ type, props, key })
  const animate = (value, config, children) => ({ value, config, children, stopped: false, start(done) { this.done = done; running.push(this) }, stop() { this.stopped = true }, finish() { if (this.value) this.value.setValue(this.config.toValue); this.children?.forEach(child => child.value.setValue(child.config.toValue)); this.done?.({ finished: true }) } })
  const native = {
    View: 'View', TouchableOpacity: 'TouchableOpacity', FlatList: 'FlatList', TextInput: 'TextInput', SafeAreaView: 'SafeAreaView', Platform: { OS: 'android' }, ScrollView: 'ScrollView', Pressable: 'Pressable', ActivityIndicator: 'Spinner', Keyboard: { dismiss() {} },
    StyleSheet: { create: value => value, absoluteFill: {} }, useWindowDimensions: () => ({ width }),
    Easing: { cubic: 'cubic', out: value => value, bezier: (...args) => args },
    Animated: { View: 'AnimatedView', Value: class { constructor(value) { this.value = value } setValue(value) { this.value = value } interpolate(config) { return { value: this, config } } }, spring: (value, config) => animate(value, config), timing: (value, config) => animate(value, config), parallel: children => animate(null, null, children) },
  }
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  vm.runInNewContext(outputText, { exports, console, ...globals, require(name) {
    const available = { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native, '@/utils/hooks/useReducedMotion': { default: () => reduced }, '@/config/homeTabs': navigation, '../HomePageHeader': { default: 'HomePageHeader' }, '../pagerScroll': { HomePagerScrollContext: { Provider: 'PagerProvider' } }, '@/theme/design': { design: { type: { largeTitle: 34 } }, useDesignColors: () => ({ background: 'white', accent: 'red', secondarySurface: 'gray' }) }, ...imports }
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
  return { render, exports, mount: (child, initialProps = {}) => { cells.forEach(cell => cell?.cleanup?.()); cells.length = 0; component = child; props = initialProps; return render() }, tree: () => tree, running, reduce: value => { reduced = value }, resize: value => { width = value }, cleanup: () => cells.forEach(cell => cell?.cleanup?.()) }
}
test('tab transitions skip the initial render, reveal in the chosen direction and stop on interruption', () => {
  const h = harness('src/components/common/PageTransition.tsx')
  h.render({ transitionKey: 'search', children: 'content' }); assert.equal(h.running.length, 0)
  h.render({ transitionKey: 'library', direction: 1 }); const first = h.running.at(-1)
  assert.equal(h.tree().props.style.transform[0].translateX.value, 20)
  assert.equal(h.tree().props.style.opacity.value, 0.94)
  h.render({ transitionKey: 'search', direction: -1 }); assert.equal(first.stopped, true)
  assert.equal(h.tree().props.style.transform[0].translateX.value, -20)
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
function home(initial = 'nav_love') {
  const event = new EventEmitter(); const state = { navActiveId: initial }; const calls = []; const scroll = []
  const settings = { 'common.homePageScroll': true }; const lx = { homePagerIdle: true }
  const setNavActiveId = id => { if (state.navActiveId !== id) { state.navActiveId = id; event.emit('navActiveIdUpdated', id) } }
  const h = harness('src/screens/Home/Vertical/Main.tsx', {
    '../Views/Search': { default: 'Search' }, '../Views/SongList': { default: 'SongList' }, '../Views/Mylist': { default: 'Mylist' }, '../Views/Leaderboard': { default: 'Leaderboard' }, '../Views/Setting': { default: 'Setting' },
    '@/store/common/state': { default: state }, '@/store/setting/state': { default: { setting: settings } },
    '@/utils/tools': { createStyle: value => value }, 'react-native-pager-view': { default: 'Pager' }, '@/core/common': { setNavActiveId }, '@/components/common/PageTransition': { default: 'PageTransition' },
  }, { global: { state_event: event, lx } })
  const pager = () => nodes(h.tree()).find(node => node.type === 'Pager')
  const controls = { setPage: index => calls.push({ index, animated: true }), setPageWithoutAnimation: index => calls.push({ index, animated: false }), setScrollEnabled: value => scroll.push(value) }
  h.render(); pager().props.ref.current = controls
  return { ...h, event, state, settings, calls, scroll, pager, lx,
    select: index => { pager().props.onPageSelected({ nativeEvent: { position: index } }); h.render() },
    tap: id => { setNavActiveId(id); h.render() },
    drag: () => { pager().props.onPageScrollStateChanged({ nativeEvent: { pageScrollState: 'dragging' } }); h.render() },
    lock: (id, locked) => { nodes(h.tree()).find(node => node.type === 'PagerProvider').props.value(id, locked); h.render() },
  }
}
test('library is the first native page and swiping visits the visible tabs in exactly their displayed order', () => {
  const h = home()
  const expected = ['nav_love', 'nav_songlist', 'nav_top', 'nav_search', 'nav_setting']
  assert.deepEqual(Array.from(navigation.HOME_TAB_IDS), expected)
  assert.deepEqual(Array.from(h.pager().props.children, node => node.key), expected)
  assert.equal(h.pager().props.initialPage, 0)
  h.drag(); h.select(1); assert.equal(h.state.navActiveId, 'nav_songlist')
  h.drag(); h.select(0); assert.equal(h.state.navActiveId, 'nav_love'); assert.deepEqual(h.calls, [])
  h.select(-1); assert.equal(h.state.navActiveId, 'nav_love')
  for (let i = 1; i < expected.length; i++) { h.drag(); h.select(i); assert.equal(h.state.navActiveId, expected[i]) }
  h.cleanup()
})
test('adjacent tab taps slide natively, distant taps skip intermediate pages, and delayed events cannot undo the latest choice', () => {
  const h = home()
  h.tap('nav_songlist'); assert.deepEqual(h.calls, [{ index: 1, animated: true }]); assert.equal(h.tree().props.enabled, false); assert.equal(h.lx.homePagerIdle, false)
  assert.equal(h.pager().props.initialPage, 0)
  h.select(0); assert.equal(h.state.navActiveId, 'nav_songlist'); h.select(1)
  h.tap('nav_setting'); assert.equal(h.tree().props.enabled, true); assert.equal(h.lx.homePagerIdle, true); assert.deepEqual(h.calls.at(-1), { index: 4, animated: false })
  h.tap('nav_love'); h.select(4); assert.equal(h.state.navActiveId, 'nav_love'); h.select(0)
  assert.equal(h.tree().props.direction, -1); assert.equal(h.tree().props.transitionKey, 'nav_love:3')
  h.cleanup(); assert.equal(h.event.listenerCount('navActiveIdUpdated'), 0)
})
test('a finger drag can interrupt a pending tab slide, and reduced motion completes native navigation immediately', () => {
  const h = home()
  h.tap('nav_songlist'); h.drag(); h.select(2); assert.equal(h.state.navActiveId, 'nav_top')
  h.reduce(true); h.render(); h.tap('nav_search'); assert.deepEqual(h.calls.at(-1), { index: 3, animated: false })
  h.select(3); h.reduce(false); h.render(); h.tap('nav_setting'); assert.equal(h.calls.at(-1).animated, true)
  h.reduce(true); h.render(); assert.deepEqual(h.calls.at(-1), { index: 4, animated: false })
  h.cleanup()
})
test('detail gesture locks follow the active page, tab taps still work, and unlocking respects the saved scroll setting', () => {
  const h = home()
  h.lock('nav_love', true); assert.equal(h.pager().props.scrollEnabled, false)
  h.lock('nav_setting', true); h.tap('nav_setting'); assert.equal(h.pager().props.scrollEnabled, false)
  h.lock('nav_love', false); assert.equal(h.pager().props.scrollEnabled, false)
  h.lock('nav_setting', false); assert.equal(h.pager().props.scrollEnabled, true)
  h.settings['common.homePageScroll'] = false; h.event.emit('configUpdated', ['common.homePageScroll']); h.render()
  h.lock('nav_setting', true); h.lock('nav_setting', false); assert.equal(h.pager().props.scrollEnabled, false)
  h.tap('nav_love'); assert.deepEqual(h.calls.at(-1), { index: 0, animated: false }); h.cleanup()
})
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

test('neighbor pages mount with their headings before the first swipe and recover after settings invalidates them', () => {
  const h = home(); const pages = h.pager().props.children
  const Page = pages[0].props.children.type
  const library = h.mount(Page, { id: 'nav_love' }); assert.equal(library.props.children[0].props.id, 'nav_love'); assert.equal(library.props.children[1].type, 'Mylist')
  assert.equal(h.mount(Page, { id: 'nav_top' }), null)
  h.state.navActiveId = 'nav_songlist'; h.event.emit('navActiveIdUpdated', h.state.navActiveId)
  assert.equal(h.render().props.children[0].props.id, 'nav_top'); assert.equal(h.render().props.children[1].type, 'Leaderboard')
  h.state.navActiveId = 'nav_setting'; h.event.emit('navActiveIdUpdated', h.state.navActiveId); h.event.emit('themeUpdated'); assert.equal(h.render(), null)
  h.state.navActiveId = 'nav_songlist'; h.event.emit('navActiveIdUpdated', h.state.navActiveId); assert.equal(h.render().props.children[1].type, 'Leaderboard')
  h.cleanup(); assert.equal(h.event.listenerCount('navActiveIdUpdated'), 0)
})
test('the shell renders its navigation in the same order as the pager and leaves page headings inside pages', () => {
  const event = new EventEmitter(); const taps = []
  const h = harness('src/screens/Home/AppleShell.tsx', {
    '@/store/common/hook': { useNavActiveId: () => 'nav_love', useStatusbarHeight: () => 24 }, '@/core/common': { setNavActiveId: id => taps.push(id) }, '@/utils/hooks': { useHorizontalMode: () => false }, '@/lang': { useI18n: () => key => key },
    '@/components/common/Icon': { Icon: 'Icon' }, '@/components/common/Text': { default: 'Text' }, '@/components/common/StatusBar': { default: 'StatusBar' }, '@/components/player/PlayerBar': { default: 'PlayerBar' }, './Vertical/Main': { default: 'Main' },
  }, { global: { app_event: event } })
  h.render(); const tabs = nodes(h.tree()).filter(node => node.props?.accessibilityRole === 'tab')
  assert.equal(tabs.length, 5); assert.equal(tabs[0].props.accessibilityState.selected, true)
  tabs.forEach(tab => tab.props.onPress()); assert.deepEqual(taps, Array.from(navigation.HOME_TAB_IDS))
  assert.equal(nodes(h.tree()).some(node => node.props?.accessibilityRole === 'header'), false); h.cleanup()
})
test('a detail scroll lock releases on exit and unmount without affecting unrelated pages', () => {
  const h = harness('src/screens/Home/pagerScroll.ts'); const calls = []
  h.exports.HomePagerScrollContext.value = (...args) => calls.push(args)
  let locked = true
  h.mount(() => { h.exports.useHomeScrollLock('nav_love', locked); return null })
  assert.deepEqual(calls, [['nav_love', true]])
  locked = false; h.render(); assert.deepEqual(calls.at(-1), ['nav_love', false])
  locked = true; h.render(); h.cleanup(); assert.deepEqual(calls.slice(-2), [['nav_love', true], ['nav_love', false]])
})
test('menu actions wait for exit completion and a committed frame, reject double taps, and cancel on reopen or unmount', () => {
  const frames = new Map(); let frame = 0
  const calls = []; const visibility = []; const ref = { current: null }
  const h = harness('src/components/common/Menu.tsx', {
    './Modal': { default: 'Modal' }, './Text': { default: 'Text' }, './Icon': { Icon: 'Icon' }, '@/utils/hooks': { useWindowSize: () => ({ width: 390, height: 844 }) }, '@/lang': { useI18n: () => key => key },
  }, { requestAnimationFrame: fn => { frames.set(++frame, fn); return frame }, cancelAnimationFrame: id => frames.delete(id) })
  const menus = [{ action: 'rename', label: 'Rename' }, { action: 'sort', label: 'Sort' }]
  h.render({ menus, onPress: item => calls.push(item.action), onHide: () => calls.push('hidden') }, ref)
  h.tree().props.ref.current = { setVisible: value => visibility.push(value) }
  const rows = () => nodes(h.tree()).filter(node => node.type === 'Pressable' && node.props.accessibilityRole === 'button')
  rows()[0].props.onPress(); rows()[1].props.onPress(); assert.deepEqual(visibility, [false]); assert.deepEqual(calls, [])
  h.tree().props.onHide(); assert.deepEqual(calls, ['hidden']); assert.equal(frames.size, 1)
  for (const fn of frames.values()) fn(); frames.clear(); assert.deepEqual(calls, ['hidden', 'rename'])
  rows()[0].props.onPress(); h.tree().props.onHide(); ref.current.show({ x: 0, y: 0, w: 0, h: 0 })
  for (const fn of frames.values()) fn(); frames.clear(); assert.equal(calls.filter(value => value === 'rename').length, 1)
  rows()[0].props.onPress(); h.tree().props.onHide(); h.cleanup(); assert.equal(frames.size, 0)
})
test('library detail transitions retain the filtered overview and return from its manager to the playlist before unlocking gestures', async() => {
  const event = new EventEmitter(); const locks = []; let back
  const lists = [{ id: 'default', name: 'Default' }, { id: 'love', name: 'Loved' }]
  const state = { activeListId: 'default', allList: lists, tempList: { id: 'temp', name: 'Queue' } }
  const t = key => key
  const h = harness('src/screens/Home/Views/Mylist/index.tsx', {
    '@/components/common/Text': { default: 'Text' }, '@/components/common/Image': { default: 'Image' }, '@/components/common/Icon': { Icon: 'Icon' }, '@/components/PlaylistEditor': { default: 'PlaylistEditor' }, '@/components/common/StackTransition': { default: 'StackTransition' }, '@/components/MusicAddModal': { default: 'MusicAddModal' },
    '../../pagerScroll': { useHomeScrollLock: (id, locked) => locks.push([id, locked]) }, './colors': { useCollectionColors: () => ({ background: '#000', text: '#F5F5F7', secondary: '#C2C2C7', surface: '#161618', accent: 'red' }) },
    '@/store/list/hook': { useMyList: () => lists, useActiveListId: () => state.activeListId }, '@/store/common/hook': { useNavActiveId: () => 'nav_love' }, '@/store/player/hook': { usePlayerMusicInfo: () => ({ id: '' }) }, '@/lang': { useI18n: () => t },
    '@/utils/hooks': { useLayout: () => ({ width: 390, onLayout() {} }), useHorizontalMode: () => false }, '@/utils/hooks/useBackHandler': { useBackHandler: fn => { back = fn } },
    '@/core/list': { getListMusics: async() => [], setActiveList: id => { state.activeListId = id } }, '@/core/common': {}, '@/core/player/player': {}, '@/core/player/recentHistory': { useRecentHistory: () => [] }, '@/config/constant': { LIST_IDS: { DEFAULT: 'default', LOVE: 'love', TEMP: 'temp' } }, '@/utils/tools': {},
    '@/store/setting/state': { default: { setting: {} } }, '@/store/player/state': { default: {} }, '@/store/list/state': { default: state }, './CollectionDetail': { default: 'CollectionDetail' }, './MyList': { default: 'PlaylistManager' },
  }, { global: { app_event: event } })
  h.render(); await new Promise(resolve => setImmediate(resolve)); h.render()
  const stack = () => h.tree().props.children[0]
  const overview = () => nodes(stack().props.children)
  overview().find(node => node.type === 'TextInput').props.onChangeText('Default'); h.render()
  overview().find(node => node.type === 'FlatList').props.renderItem({ item: lists[0] }).props.onPress(); h.render()
  assert.equal(stack().props.detailKey, 'library-detail'); assert.deepEqual(locks.at(-1), ['nav_love', true])
  assert.equal(overview().find(node => node.type === 'TextInput').props.value, 'Default')
  stack().props.onVisibleChange(true); h.render()
  event.emit('changeLoveListVisible', true); h.render()
  assert.equal(stack().props.detail.props.detailKey, 'manager')
  assert.ok(nodes(stack().props.detail.props.children).some(node => node.type === 'CollectionDetail'))
  assert.equal(back(), true); h.render(); assert.equal(stack().props.detail.props.detailKey, undefined)
  assert.equal(stack().props.detailKey, 'library-detail')
  assert.equal(back(), true); h.render(); assert.equal(stack().props.detailKey, undefined); assert.deepEqual(locks.at(-1), ['nav_love', true])
  stack().props.onVisibleChange(false); h.render(); assert.deepEqual(locks.at(-1), ['nav_love', false])
  assert.equal(overview().find(node => node.type === 'TextInput').props.value, 'Default')
  const shortcuts = nodes(overview().find(node => node.type === 'FlatList').props.ListHeaderComponent).filter(node => node.type === 'Pressable')
  shortcuts[0].props.onPress(); h.render(); assert.equal(stack().props.detailKey, 'library-detail')
  assert.equal(back(), true); h.render()
  shortcuts[1].props.onPress(); h.render(); assert.ok(nodes(stack().props.detail.props.children).some(node => node.type === 'PlaylistManager'))
  assert.equal(back(), true); h.render(); assert.equal(stack().props.detailKey, undefined)
  h.cleanup(); assert.equal(event.listenerCount('changeLoveListVisible'), 0)
})

test('dark playlist rows keep readable metadata and usable actions even when the source is unsupported', () => {
  let supported = false; let additions = 0
  const colorsModule = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src/screens/Home/Views/Mylist/colors.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports: colorsModule, require: name => name === '@/theme/design' ? { getDesignColors: theme => ({ text: theme['c-font'], surface: 'light', accent: 'red' }) } : {},
  })
  const colors = colorsModule.getCollectionColors({ isDark: true })
  assert.equal(colors.background, '#000000'); assert.equal(colors.text, '#F5F5F7')
  assert.equal(colorsModule.getCollectionColors({ isDark: false, 'c-font': 'lightText' }).text, 'lightText')
  const h = harness('src/screens/Home/Views/Mylist/MusicList/ListItem.tsx', {
    '@/config/constant': { LIST_ITEM_HEIGHT: 68 }, '@/components/common/Icon': { Icon: 'Icon' }, '@/utils/tools': { createStyle: value => value },
    '@/store/theme/hook': { useTheme: () => ({ isDark: true, 'c-primary': 'red' }) }, '@/store/common/hook': { useAssertApiSupport: () => supported }, '@/utils/pixelRatio': { scaleSizeH: value => value },
    '@/components/common/Text': { default: 'Text' }, '@/components/common/Image': { default: 'Image' }, '@/components/QuickAddProvider': { useQuickAdd: () => () => { additions++ } }, '@/lang': { useI18n: () => key => key }, '../colors': { useCollectionColors: () => colors },
  })
  const item = { id: 'song', name: 'Title', singer: 'Singer', source: 'kw', interval: '03:00', meta: {} }
  h.render({ item, index: 0, activeIndex: -1, selectedList: [], rowInfo: { rowWidth: 390 }, isShowInterval: true })
  assert.equal(h.tree().props.style.opacity, 1)
  const text = nodes(h.tree()).filter(node => node.type === 'Text')
  assert.equal(text[0].props.color, colors.text); assert.equal(text[1].props.color, colors.secondary); assert.equal(text[2].props.color, colors.secondary)
  nodes(h.tree()).find(node => node.props?.accessibilityLabel === 'library_add Title').props.onPress(); assert.equal(additions, 1)
  supported = true; h.render({ activeIndex: 0 }); assert.equal(nodes(h.tree()).find(node => node.type === 'Text').props.color, colors.accent)
})
