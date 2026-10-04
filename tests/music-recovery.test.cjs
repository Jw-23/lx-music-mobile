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
  vm.runInNewContext(outputText, { exports, console: { log() {} }, ...globals, require(name) {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`)
    return imports[name]
  } }, { filename: file })
  return exports
}
const converters = load('src/utils/index.ts', { './common': {}, he: {}, '@/utils/simplify-chinese-main': {} })
const recovery = load('src/core/music/sameSource.ts')
const info = (id = 'one', source = 'tx', overrides = {}) => ({
  id: `${source}_${id}`, name: 'Song', singer: 'Artist', source, interval: '03:20',
  meta: { songId: id, albumName: 'Album', qualitys: [{ type: '128k', size: null }], _qualitys: { '128k': { size: null } }, strMediaMid: 'fresh-media' }, ...overrides,
})
const flush = () => new Promise(resolve => setImmediate(resolve))
function clock() {
  let time = 0; let id = 0; const timers = new Map()
  return {
    timers, now: () => time,
    setTimer: (fn, delay) => { timers.set(++id, { fn, time: time + delay }); return id }, clearTimer: id => timers.delete(id),
    advance(ms) { time += ms; for (const [id, timer] of timers) if (timer.time <= time) { timers.delete(id); timer.fn() } },
  }
}
function sourceRecovery(options = {}) {
  const timer = clock(); const searches = []; const requests = []
  const service = recovery.createSameSourceRecovery({ ...timer,
    search: async original => { searches.push(original); return options.search ? options.search(original) : [info()] },
    request: async candidate => { requests.push(candidate); return options.request ? options.request(candidate) : { musicInfo: candidate, url: 'https://audio.test/song', quality: '128k', isFromCache: false } },
    shouldAbort: error => ['cancelled', 'rate limited'].includes(error?.message),
  })
  return { service, timer, searches, requests }
}
test('same-source matching prioritizes stable identity and accepts updated media IDs or hashes', () => {
  const original = info('one', 'kg'); original.meta.hash = 'old-hash'
  const fresh = info('one', 'kg'); fresh.id = 'one_new-hash'; fresh.meta.hash = 'new-hash'
  assert.equal(recovery.matchSameSourceMusic(original, [info('different', 'kg'), fresh])[0], fresh)
  const before = JSON.stringify(original)
  recovery.matchSameSourceMusic(original, [fresh])
  assert.equal(JSON.stringify(original), before)
})
test('changed remote IDs require matching recording evidence and cannot select a cover, live version or another source', () => {
  const original = info()
  const wrong = [info('live', 'tx', { name: 'Song (Live)' }), info('cover', 'tx', { singer: 'Other Artist' }), info('one', 'wy'), info('other-time', 'tx', { interval: '04:20' })]
  assert.equal(recovery.matchSameSourceMusic(original, wrong).length, 0)
  const fresh = info('new-id')
  assert.equal(recovery.matchSameSourceMusic(original, [fresh])[0], fresh)
  const sparse = info('missing', 'tx', { interval: null }); sparse.meta.albumName = ''
  const unknown = info('unknown', 'tx', { interval: null }); unknown.meta.albumName = ''
  assert.equal(recovery.matchSameSourceMusic(sparse, [unknown]).length, 0)
})
test('duplicate search rows are ignored and recovery tries at most two candidates', async() => {
  const candidates = [info('one'), info('two'), info('three'), info('four')]
  const p = sourceRecovery({ search: async() => [candidates[0], candidates[0], ...candidates.slice(1)], request: async() => { throw new Error('not playable') } })
  await assert.rejects(p.service.recover(info(), undefined, false))
  assert.equal(p.requests.length, 2)
  assert.equal(p.service.getMetadata(info()).meta.songId, 'one')
})
test('concurrent playlist and preload recovery share search; failed searches release the pending slot', async() => {
  let resolveSearch; let fail = false
  const p = sourceRecovery({ search: () => fail ? Promise.reject(new Error('offline')) : new Promise(resolve => { resolveSearch = resolve }) })
  const first = p.service.recover(info(), undefined, false)
  const second = p.service.recover(info(), undefined, false)
  await flush(); assert.equal(p.searches.length, 1)
  resolveSearch([info()]); await Promise.all([first, second])
  fail = true; await assert.rejects(p.service.recover(info(), undefined, false))
  fail = false
  const retry = p.service.recover(info(), undefined, false); await flush(); resolveSearch([info()]); await retry
  assert.equal(p.searches.length, 3)
  assert.equal(p.timer.timers.size, 0)
})
test('search timeout permits retry and a late old result cannot replace the new recovered metadata', async() => {
  const pending = []
  const p = sourceRecovery({ search: () => new Promise(resolve => pending.push(resolve)) })
  const old = p.service.recover(info(), undefined, false)
  await flush(); const rejected = assert.rejects(old, /timeout/); p.timer.advance(12_000); await rejected
  const retry = p.service.recover(info(), undefined, false); await flush()
  const fresh = info(); fresh.meta.strMediaMid = 'new-media'; pending[1]([fresh]); await retry
  const stale = info(); stale.meta.strMediaMid = 'old-media'; pending[0]([stale]); await flush()
  assert.equal(p.service.getMetadata(info()).meta.strMediaMid, 'new-media')
  assert.equal(p.timer.timers.size, 0)
})
test('successful recovered metadata has a bounded lifetime and expired entries use the original song', async() => {
  const original = info(); const fresh = info(); fresh.meta.strMediaMid = 'new-media'
  const p = sourceRecovery({ search: async() => [fresh] })
  await p.service.recover(original, undefined, false)
  assert.equal(p.service.getMetadata(original), fresh)
  p.timer.advance(15 * 60_000)
  assert.equal(p.service.getMetadata(original), original)
})
test('empty URLs and unsuccessful candidates are not remembered; cancellation stops further candidate requests', async() => {
  const p = sourceRecovery({ search: async() => [info('one'), info('two')], request: async() => ({ url: '  ' }) })
  await assert.rejects(p.service.recover(info(), undefined, false))
  assert.equal(p.requests.length, 2)
  const cancelled = sourceRecovery({ search: async() => [info('one'), info('two')], request: async() => { throw new Error('cancelled') } })
  await assert.rejects(cancelled.service.recover(info(), undefined, false), /cancelled/)
  assert.equal(cancelled.requests.length, 1)
})
function musicService(options = {}) {
  const timer = clock(); const calls = { requests: [], searches: [], other: 0, saved: [], toggles: 0 }; const cache = new Map()
  const original = options.original || info(); const fresh = options.fresh || info()
  const sdk = {}
  for (const source of ['tx', 'kg', 'wy', 'kw', 'mg']) sdk[source] = {
    musicSearch: { search: async(keyword) => { calls.searches.push({ source, keyword }); if (options.searchError) throw options.searchError; return { list: options.searchResult || [converters.toOldMusicInfo(fresh)] } } },
    getMusicUrl(old, quality) {
      calls.requests.push({ old, quality })
      return { promise: options.request ? options.request(old, quality) : old.strMediaMid === 'fresh-media' ? Promise.resolve({ url: 'https://audio.test/fresh', type: quality }) : Promise.reject(new Error('not found')) }
    },
  }
  const getStoreMusicUrl = async(music, quality) => cache.get(`${music.id}:${quality}`) || ''
  const imports = {
    '@/utils/musicSdk': { default: sdk, findMusic: async() => { calls.other++; return options.otherResult || [] } },
    '@/utils/data': { getMusicUrl: getStoreMusicUrl, getPlayerLyric: async() => ({ lyric: '' }) },
    '@/utils': { ...converters, langS2T: async value => value }, '@/utils/tools': { assertApiSupport: () => true },
    '@/store/setting/state': { default: { setting: { 'player.playQuality': options.preferred || '128k' } } },
    '@/utils/message': { requestMsg: { cancelRequest: 'cancelled', tooManyRequests: 'rate limited' } },
    'react-native-background-timer': { default: { setTimeout: timer.setTimer, clearTimeout: timer.clearTimer } },
    '@/utils/musicSdk/api-source': {}, './sameSource': recovery,
  }
  const global = { lx: { apiInitPromise: [Promise.resolve(true)], qualityList: { tx: ['128k', '320k', 'flac'], kg: ['128k', '320k', 'flac'] } }, i18n: { t: key => key } }
  const utils = load('src/core/music/utils.ts', imports, { global })
  const online = load('src/core/music/online.ts', {
    './utils': utils, '@/utils/data': { getMusicUrl: getStoreMusicUrl, saveMusicUrl: async(music, quality, url) => { cache.set(`${music.id}:${quality}`, url); calls.saved.push({ id: music.id, quality, url }) } },
    '@/core/list': {}, '@/store/setting/state': imports['@/store/setting/state'],
  })
  return { calls, utils, online, original, fresh, timer, cache }
}
test('playlist stale media metadata recovers through the playable search result and later plays use the repaired metadata/cache', async() => {
  const original = info(); original.meta.strMediaMid = 'outdated-media'
  const before = JSON.stringify(original)
  const p = musicService({ original })
  assert.equal(await p.online.getMusicUrl({ musicInfo: original, isRefresh: false, allowToggleSource: false }), 'https://audio.test/fresh')
  assert.equal(p.calls.searches.length, 1)
  assert.equal(p.calls.other, 0)
  assert.equal(p.calls.requests.length, 2)
  assert.equal(p.calls.requests[1].old.strMediaMid, 'fresh-media')
  assert.equal(await p.online.getMusicUrl({ musicInfo: original, isRefresh: false }), 'https://audio.test/fresh')
  assert.equal(p.calls.requests.length, 2)
  assert.equal(JSON.stringify(original), before)
})
test('Kugou playlist qualities without usable hashes are skipped; same-source search refreshes outdated hashes', async() => {
  const original = info('one', 'kg'); original.meta.hash = 'old-hash'; original.meta._qualitys.flac = { size: null, hash: '' }
  const fresh = info('one', 'kg'); fresh.id = 'one_new-hash'; fresh.meta.hash = 'new-hash'; fresh.meta._qualitys.flac = { size: null, hash: 'new-flac' }
  fresh.meta.qualitys.push({ type: 'flac', size: null, hash: 'new-flac' })
  const p = musicService({ original, fresh, preferred: 'flac', request: async old => old.hash === 'new-hash' ? { url: 'https://audio.test/kg', type: 'flac' } : Promise.reject(new Error('not found')) })
  assert.equal(await p.online.getMusicUrl({ musicInfo: original, isRefresh: false }), 'https://audio.test/kg')
  assert.equal(p.calls.requests[0].quality, '128k')
  assert.equal(p.calls.requests[1].quality, 'flac')
  assert.ok(p.calls.saved.some(save => save.id === original.id))
  assert.ok(p.calls.saved.some(save => save.id === fresh.id))
})
test('a normal search song plays without recovery or extra searches', async() => {
  const p = musicService()
  assert.equal(await p.online.getMusicUrl({ musicInfo: p.original, isRefresh: false }), 'https://audio.test/fresh')
  assert.equal(p.calls.searches.length, 0)
  assert.equal(p.calls.requests.length, 1)
})
test('rate limits and cancellation from URL or same-source search stop recovery and never trigger cross-source searches', async() => {
  for (const message of ['cancelled', 'rate limited']) {
    const direct = musicService({ request: async() => { throw { message } } })
    await assert.rejects(direct.online.getMusicUrl({ musicInfo: direct.original, isRefresh: false }), error => error.message === message)
    assert.equal(direct.calls.searches.length, 0)
    assert.equal(direct.calls.other, 0)
    const original = info(); original.meta.strMediaMid = 'outdated'
    const searched = musicService({ original, searchError: new Error(message) })
    await assert.rejects(searched.online.getMusicUrl({ musicInfo: original, isRefresh: false }), error => error.message === message)
    assert.equal(searched.calls.other, 0)
  }
})
test('when same-source metadata cannot be repaired the existing cross-source recovery still runs', async() => {
  const original = info(); original.meta.strMediaMid = 'outdated'
  const other = info('other', 'wy')
  const p = musicService({ original, searchResult: [], otherResult: [converters.toOldMusicInfo(other)], request: async old => old.source === 'wy' ? { url: 'https://audio.test/fresh', type: '128k' } : Promise.reject(new Error('not found')) })
  assert.equal(await p.online.getMusicUrl({ musicInfo: original, isRefresh: false }), 'https://audio.test/fresh')
  assert.equal(p.calls.other, 1)
  assert.equal(p.calls.requests.at(-1).old.source, 'wy')
})
test('empty native URL responses recover once and are never persisted as usable URLs', async() => {
  const p = musicService({ searchResult: [], request: async() => ({ url: '', type: '128k' }) })
  await assert.rejects(p.online.getMusicUrl({ musicInfo: p.original, isRefresh: false }))
  assert.equal(p.calls.requests.length, 1)
  assert.equal(p.calls.saved.length, 0)
})
test('missing quality metadata from a playlist normalizes safely and defaults to the basic quality', () => {
  const music = converters.toNewMusicInfo({ name: 'Song', singer: 'Artist', songmid: 'one', source: 'tx' })
  assert.deepEqual(Object.keys(music.meta._qualitys), [])
  assert.equal(music.meta.qualitys.length, 0)
  const p = musicService()
  assert.equal(p.utils.getPlayQuality('flac', music), '128k')
})

test('URL refresh bypasses stored URLs while using the known good same-source metadata', async() => {
  const original = info(); original.meta.strMediaMid = 'outdated'
  const p = musicService({ original })
  await p.online.getMusicUrl({ musicInfo: original, isRefresh: false })
  const before = p.calls.requests.length
  await p.online.getMusicUrl({ musicInfo: original, isRefresh: true })
  assert.equal(p.calls.requests.length, before + 1)
  assert.equal(p.calls.requests.at(-1).old.strMediaMid, 'fresh-media')
  assert.equal(p.calls.searches.length, 1)
})
test('an empty cross-source URL is rejected and recovery continues to the next usable source', async() => {
  const original = info(); original.meta.strMediaMid = 'outdated'
  const other = info('other', 'wy'); const final = info('final', 'kg'); final.meta.hash = 'valid-hash'
  const p = musicService({ original, searchResult: [], otherResult: [other, final].map(converters.toOldMusicInfo), request: async old => old.source === 'kg' ? { url: 'https://audio.test/kg', type: '128k' } : { url: '', type: '128k' } })
  assert.equal(await p.online.getMusicUrl({ musicInfo: original, isRefresh: false }), 'https://audio.test/kg')
  assert.equal(p.calls.requests.length, 3)
  assert.ok(p.calls.saved.every(saved => saved.url))
})
