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
  vm.runInNewContext(outputText, { exports, console, ...globals, require(name) {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`)
    return imports[name]
  } }, { filename: file })
  return exports
}
const geometry = load('src/components/common/dragSort.ts')
test('drag geometry accounts for scrolling, font-dependent row height, bounds and both insertion directions', () => {
  assert.equal(geometry.getDragIndex(72, 216, 72, 0, 8), 4)
  assert.equal(geometry.getDragIndex(144, 144, 144, 0, 8), 2)
  assert.equal(geometry.getDragIndex(-999, 0, 72, 2, 6), 2)
  assert.equal(geometry.getDragIndex(9999, 0, 72, 2, 6), 6)
  assert.equal(geometry.getDragShift(3, 1, 4, 72), -72)
  assert.equal(geometry.getDragShift(2, 4, 1, 72), 72)
  assert.equal(geometry.getDragShift(0, 4, 1, 72), 0)
  const original = ['a', 'b', 'c', 'd']
  assert.deepEqual(Array.from(geometry.reorderItems(original, 3, 1)), ['a', 'd', 'b', 'c'])
  assert.deepEqual(Array.from(geometry.reorderItems(original, 1, 3)), ['a', 'c', 'd', 'b'])
  assert.deepEqual(original, ['a', 'b', 'c', 'd'])
})
test('edge scrolling accelerates near the edge and stops at the actual content boundaries', () => {
  assert.equal(geometry.getDragScroll(200, 400, 100, 2000), 100)
  assert.ok(geometry.getDragScroll(390, 400, 100, 2000) > 100)
  assert.ok(geometry.getDragScroll(10, 400, 100, 2000) < 100)
  assert.equal(geometry.getDragScroll(0, 400, 0, 2000), 0)
  assert.equal(geometry.getDragScroll(400, 400, 1600, 2000), 1600)
  assert.equal(geometry.getDragScroll(400, 400, 0, 200), 0)
})
function dragging(options = {}) {
  const cells = []; const effects = []; const frames = new Map(); const moves = []; const scrolls = []
  let cursor = 0; let frameId = 0
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index])
  const react = {
    useRef(value) { const i = cursor++; cells[i] ||= { current: value }; return cells[i] },
    useState(value) { const i = cursor++; if (!(i in cells)) cells[i] = value; return [cells[i], value => { cells[i] = typeof value === 'function' ? value(cells[i]) : value }] },
    useMemo(fn, deps) { const i = cursor++; if (!same(cells[i]?.deps, deps)) cells[i] = { value: fn(), deps }; return cells[i].value },
    useEffect(fn, deps) { const i = cursor++; if (!same(cells[i]?.deps, deps)) effects.push(() => { cells[i]?.cleanup?.(); cells[i] = { deps, cleanup: fn() } }) },
  }
  const jsx = (type, props, key) => ({ type, props, key })
  const native = {
    View: 'View', FlatList: 'FlatList', StyleSheet: { create: value => value },
    PanResponder: { create: handlers => ({ panHandlers: handlers }) },
    Animated: { View: 'AnimatedView', Value: class { constructor(value) { this.value = value } setValue(value) { this.value = value } }, spring: () => ({ start() {}, stop() {} }) },
  }
  const component = load('src/components/common/DragSortList.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
    '@/utils/hooks/useReducedMotion': { default: () => false }, './dragSort': geometry,
  }, { requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId }, cancelAnimationFrame: id => frames.delete(id) }).default
  let props = { data: ['a', 'b', 'c', 'd', 'e', 'f'], rowHeight: 72, revisionKey: 'initial', keyExtractor: item => item,
    renderRow: (item, floating, handle) => ({ item, floating, handle }),
    getRange: () => [0, 5], onMove: (from, to) => moves.push([from, to]), empty: null, ...options }
  let tree
  const render = patch => {
    props = { ...props, ...patch }; cursor = 0; tree = component(props)
    tree.props.ref.current = { measureInWindow: done => done(0, 100, 320, 288) }
    tree.props.children[0].props.ref.current = { scrollToOffset: command => { scrolls.push(command) } }
    while (effects.length) effects.shift()()
    return tree
  }
  const begin = index => {
    render(); const row = tree.props.children[0].props.renderItem({ item: props.data[index], index })
    assert.equal(row.props.children.handle.onStartShouldSetResponder(), false)
    assert.equal(tree.props.onStartShouldSetPanResponder(), true)
    tree.props.onPanResponderGrant(null, { y0: 100 + index * 72 + 36 })
    render()
  }
  const move = (dy, y) => { tree.props.onPanResponderMove(null, { dy, moveY: y }); render() }
  const end = commit => { tree.props[commit ? 'onPanResponderRelease' : 'onPanResponderTerminate'](); render() }
  const step = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); render() }
  const cleanup = () => { cells.forEach(cell => cell?.cleanup?.()) }
  render()
  return { render, begin, move, end, step, cleanup, frames, moves, scrolls, tree: () => tree }
}
test('actual gesture handlers move the floating row, preview insertion and commit only on release', () => {
  const h = dragging()
  h.begin(0); h.move(144, 280)
  assert.equal(h.moves.length, 0)
  const floating = h.tree().props.children[1]
  assert.equal(floating.props.children.item, 'a')
  assert.equal(floating.props.style[1].transform[0].translateY.value, 144)
  const next = h.tree().props.children[0].props.renderItem({ item: 'b', index: 1 })
  assert.equal(next.props.shift, -72)
  h.end(true)
  assert.deepEqual(h.moves, [[0, 2]])
  assert.equal(h.frames.size, 0)
  h.cleanup()
})
test('long drags keep the viewport gesture and auto scroll while the source row is recycled', () => {
  const h = dragging({ data: Array.from({ length: 100 }, (_, i) => `song-${i}`), getRange: () => [0, 99] })
  h.begin(0); h.move(240, 382)
  for (let i = 0; i < 50; i++) h.step()
  assert.ok(h.scrolls.at(-1).offset > 288)
  h.end(true)
  assert.ok(h.moves[0][1] > 8)
  assert.equal(h.frames.size, 0)
  h.cleanup()
})
test('interruption, queue changes and unmount cancel dragging without committing stale indices', () => {
  const h = dragging()
  h.begin(0); h.move(144, 280); h.end(false)
  assert.deepEqual(h.moves, [])
  h.begin(0); h.move(144, 280)
  h.render({ revisionKey: 'song-changed', data: ['b', 'c', 'd'] }); h.end(true)
  assert.deepEqual(h.moves, [])
  assert.equal(h.frames.size, 0)
  h.render({ data: ['a', 'b', 'c', 'd', 'e', 'f'], revisionKey: 'again' })
  h.begin(0); h.move(144, 280); h.cleanup()
  assert.equal(h.frames.size, 0)
  h.end(true)
  assert.deepEqual(h.moves, [])
})
test('priority section boundaries clamp a drag, and screen readers can reorder without arrow buttons', () => {
  const h = dragging({ getRange: index => index < 2 ? [0, 1] : [2, 5] })
  h.begin(0); h.move(999, 280); h.end(true)
  assert.deepEqual(h.moves, [[0, 1]])
  const row = h.tree().props.children[0].props.renderItem({ item: 'b', index: 1 })
  assert.equal(row.props.children.handle.accessibilityRole, 'adjustable')
  row.props.children.handle.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } })
  assert.equal(h.moves.length, 1)
  row.props.children.handle.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } })
  assert.deepEqual(h.moves.at(-1), [1, 0])
  h.cleanup()
})
