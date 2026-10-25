const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, imports = {}, globals = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, ...globals, require(name) { if (!(name in imports)) throw Error('Unexpected import ' + name); return imports[name] },
  })
  return exports
}
const jsx = (type, props, key) => ({ type, props, key })
const react = { memo: f => f, useMemo: f => f(), useEffect: f => f() }
const themes = load('src/theme/themes/themes.ts')
const tv = load('src/theme/tv.ts', { './themes/themes': themes })
const layout = load('src/screens/TV/layout.ts')
const base = { id: 'apple', isDark: false, 'c-main-background': '#fff', 'c-content-background': '#fff', 'c-font': '#000', 'bg-image': { uri: 'user-photo' } }
function all(tree) {
  const nodes = []
  const visit = item => { if (Array.isArray(item)) return item.forEach(visit); if (!item || typeof item !== 'object') return; nodes.push(item); visit(item.props?.children) }
  visit(tree); return nodes
}
function luminance(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0)
}
test('TV uses an opaque dark theme without overwriting the stored phone theme or wallpaper', () => {
  const theme = tv.getTVTheme(base)
  assert.equal(theme.id, 'tv'); assert.equal(theme.isDark, true); assert.equal(theme['bg-image'], undefined)
  assert.equal(base.id, 'apple'); assert.equal(base['c-main-background'], '#fff'); assert.equal(base['bg-image'].uri, 'user-photo')
  assert.ok((luminance(theme['c-font']) + 0.05) / (luminance(theme['c-main-background']) + 0.05) > 10)
})
test('TV keeps dp geometry and type independent of 4K density and saved phone font scaling', () => {
  for (const [width, height, density] of [[960, 540, 2], [1920, 1080, 2], [3840, 2160, 4]]) {
    const imports = { 'react-native': { NativeModules: { UtilsModule: { isTVBuild: true } }, Platform: { OS: 'android' }, PixelRatio: { getFontScale: () => 2, get: () => density, getPixelSizeForLayoutSize: size => size * density } }, './windowSizeTools': { windowSizeTools: { getSize: () => ({ width, height }) } } }
    const sizing = load('src/utils/pixelRatio.ts', imports, { global: { lx: { fontSize: 2 } } })
    assert.equal(sizing.scaleSizeW(24), 24); assert.equal(sizing.scaleSizeH(48), 48); assert.equal(sizing.setSpText(17), 17)
  }
  const phone = load('src/utils/pixelRatio.ts', { 'react-native': { NativeModules: {}, Platform: { OS: 'android', isTV: false }, PixelRatio: { getFontScale: () => 1, get: () => 3, getPixelSizeForLayoutSize: size => size * 3 } }, './windowSizeTools': { windowSizeTools: { getSize: () => ({ width: 375, height: 667 }) } } }, { global: { lx: { fontSize: 2 } } })
  assert.equal(phone.scaleSizeW(24), 48); assert.equal(phone.setSpText(17), 34)
})
test('the actual Icon component uses unscaled TV icons and retains explicit sizes and phone scaling', () => {
  let television = true
  const Icon = load('src/components/common/Icon.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native-vector-icons': { createIconSetFromIcoMoon: () => 'IcoMoon' }, '@/resources/fonts/selection.json': {},
    '@/utils/pixelRatio': { scaleSizeW: n => n * 3 }, '@/theme/tv': tv,
    '@/store/theme/hook': { useTheme: () => ({ id: television ? 'tv' : 'apple' }), useTextShadow: () => false }, 'react-native': { StyleSheet: { compose: (a, b) => [a, b] } },
  }).Icon
  let icon = Icon({ name: 'play', size: 24 }); assert.equal(icon.props.size, 24); assert.equal(icon.props.allowFontScaling, false)
  icon = Icon({ name: 'play', size: 24, rawSize: 29 }); assert.equal(icon.props.size, 29)
  television = false; icon = Icon({ name: 'play', size: 24 }); assert.equal(icon.props.size, 72)
})
test('TV button glyphs fit within fixed targets instead of enlarging with the phone layout', () => {
  const Button = load('src/screens/TV/Button.tsx', { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { Pressable: 'Pressable', StyleSheet: { create: v => v } }, '@/components/common/Icon': { Icon: 'Icon' }, '@/theme/tv': tv, './layout': layout }).default
  for (const primary of [false, true]) {
    const button = Button({ primary, icon: 'play', label: 'Play', onPress() {} })
    const style = button.props.style({ pressed: false })[0]
    const ratio = button.props.children.props.rawSize / style.width
    assert.ok(style.width >= 48); assert.equal(style.width, style.height); assert.ok(ratio >= 0.35 && ratio <= 0.55)
  }
})
test('the page background reaches every TV edge while overscan padding stays inside it', () => {
  const applied = []
  const Page = load('src/components/PageContent.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, 'react-native': { View: 'View', NativeModules: { UtilsModule: { setTVMode: value => applied.push(value) } } },
    '@/store/theme/hook': { useTheme: () => tv.getTVTheme(base) }, '@/utils/hooks/useTVMode': { default: () => true }, './common/TVFocusScope': { default: 'TVFocusScope' },
    '@/components/common/ImageBackground': { default: 'ImageBackground' }, '@/utils/hooks': { useWindowSize: () => ({ width: 960, height: 540 }) }, '@/utils/pixelRatio': { scaleSizeAbsHR: n => n }, './common/Image': {}, './SizeView': { default: 'SizeView' }, '@/store/common/hook': { useBgPic: () => 'saved-wallpaper' },
  }).default
  const nodes = all(Page({ children: 'body' }))
  const root = nodes.find(node => node.type === 'TVFocusScope')
  assert.equal(root.props.style.backgroundColor, tv.TV_COLORS.background); assert.equal(root.props.style.paddingHorizontal, undefined); assert.equal(root.props.style.paddingVertical, undefined)
  const background = nodes.find(node => node.type === 'ImageBackground')
  assert.equal(background.props.style.left, 0); assert.equal(background.props.style.top, 0); assert.equal(background.props.style.width, 960); assert.equal(background.props.source, undefined)
  const content = nodes.find(node => node.type === 'View' && node.props.children === 'body')
  assert.equal(content.props.style.paddingHorizontal, 28); assert.deepEqual(applied, [true])
})
test('TV artwork fits common small and large screens while leaving room for transport and labels', () => {
  for (const [width, height] of [[640, 360], [960, 540], [1920, 1080]]) {
    const size = layout.getTVArtworkSize(width, height)
    assert.ok(size >= 72 && size <= 300); assert.ok(size < width * 0.38); assert.ok(size < height - 170)
  }
})
test('updating the TV edition selects only TV packages and never substitutes a phone APK', () => {
  const url = 'https://github.com/Jw-23/lx-music-mobile/releases'
  const release = { tag_name: 'v1.10.14', published_at: '2026-10-25', assets: ['lx-music-mobile-v1.10.14-arm64-v8a.apk', 'lx-music-tv-v1.10.14-universal.apk'].map(name => ({ name, state: 'uploaded', size: 100, browser_download_url: `${url}/download/v1.10.14/${name}` })) }
  const model = load('src/utils/releaseModel.js', { '@/config/release': { RELEASE_URL: url } })
  assert.match(model.selectReleaseAsset(release, ['arm64-v8a']), /lx-music-mobile-/)
  assert.match(model.selectReleaseAsset(release, ['arm64-v8a'], 'tv'), /lx-music-tv-.*universal/)
  release.assets.pop(); assert.throws(() => model.selectReleaseAsset(release, ['arm64-v8a'], 'tv'))
})
