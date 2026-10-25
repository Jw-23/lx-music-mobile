/* global document, sessionStorage, fetch, AbortController */
'use strict'
const el = id => document.getElementById(id)
let token = ''
try { token = sessionStorage.getItem('lx-lan-token') || '' } catch {}
let toastTimer
let state
let resultId
const searchState = { busy: false, last: undefined }
let polling = false
const saveToken = value => {
  token = value
  try { if (value) sessionStorage.setItem('lx-lan-token', value); else sessionStorage.removeItem('lx-lan-token') } catch {}
}
const toast = message => {
  el('toast').textContent = message
  el('toast').hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { el('toast').hidden = true }, 4500)
}
const paired = value => {
  el('pair').hidden = value
  el('workspace').hidden = !value
  el('logout').hidden = !value
  el('connection').textContent = value ? '已连接电视' : '局域网控制'
}
async function request(path, body, pairing = false) {
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, 55000)
  try {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': pairing ? 'text/plain' : 'application/json', ...(pairing ? {} : { Authorization: 'Bearer ' + token }) }, body: pairing ? body : JSON.stringify(body), signal: controller.signal, cache: 'no-store', credentials: 'omit' })
    const data = await response.json()
    if (!response.ok) {
      if (response.status === 401 && !pairing) { saveToken(''); paired(false) }
      throw new Error(data.error || '操作失败，请重试')
    }
    return data
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('操作超时，请刷新状态后重试')
    if (error instanceof TypeError) throw new Error('无法连接电视，请检查电视应用和网络')
    throw error
  } finally { clearTimeout(timer) }
}
const command = (action, payload = {}) => request('/api/command', { action, payload })
const node = (tag, text, className) => {
  const item = document.createElement(tag)
  if (text != null) item.textContent = text
  if (className) item.className = className
  return item
}
async function busy(button, work) {
  if (button.disabled) return
  button.disabled = true
  const original = button.textContent
  try { return await work() } catch (error) { toast(error.message) } finally { button.disabled = false; button.textContent = original }
}
function playing(info) {
  if (!info) return
  el('song-name').textContent = info.name || '选择一首喜欢的歌'
  el('song-singer').textContent = info.singer || '在下方搜索音乐并点播'
  el('song-status').textContent = info.name ? info.status || (info.playing ? '正在播放' : '已暂停') : ''
  el('play-toggle').textContent = info.playing ? 'Ⅱ' : '▶'
}
function renderSources() {
  const list = el('source-list'); list.replaceChildren()
  if (!state.sources.length) list.append(node('p', '还没有音源，从上方导入即可。', 'muted'))
  for (const source of state.sources) {
    const row = node('div', null, 'source-row')
    const info = node('div', null, 'source-info')
    const selected = state.selectedSource.id === source.id
    info.append(node('strong', source.name), node('p', source.version ? '版本 ' + source.version : '', 'muted'))
    if (source.description) info.append(node('p', source.description.slice(0, 1000), 'muted'))
    if (selected) info.append(node('p', state.selectedSource.ready ? '已启用 · 初始化成功' : state.selectedSource.message === 'initing' ? '正在初始化…' : '初始化失败，可重试', 'small'))
    const button = node('button', selected && state.selectedSource.ready ? '已启用' : selected ? '重新启用' : '使用此源', 'quiet')
    button.disabled = selected && state.selectedSource.ready
    button.addEventListener('click', () => busy(button, async() => {
      button.textContent = '初始化中…'; state = await command('source.use', { id: source.id }); renderSources(); toast(state.selectedSource.ready ? '音源已启用' : '音源初始化失败，请检查音源或重试')
    }))
    row.append(info, button); list.append(row)
  }
}
function renderSettings() {
  const list = el('settings-list'); list.replaceChildren()
  for (const setting of state.settings) {
    const row = node('div', null, 'setting-row')
    const id = 'setting-' + setting.key
    const label = node('label', setting.label); label.htmlFor = id
    const input = node(setting.type === 'select' ? 'select' : 'input'); input.id = id
    if (setting.type === 'boolean') { input.type = 'checkbox'; input.checked = setting.value } else {
      if (setting.options) for (const [value, text] of setting.options) { const option = node('option', text); option.value = value; input.append(option) }
      else { input.type = 'number'; input.min = setting.min; input.max = setting.max; input.step = '10' }
      input.value = setting.value
    }
    input.addEventListener('change', async() => {
      const value = setting.type === 'boolean' ? input.checked : setting.type === 'number' ? Number(input.value) : input.value
      input.disabled = true
      try { state = await command('settings.set', { key: setting.key, value }); setting.value = value; toast('已保存到电视') } catch (error) {
        if (setting.type === 'boolean') input.checked = setting.value; else input.value = setting.value
        toast(error.message)
      } finally { input.disabled = false }
    })
    row.append(label, input); list.append(row)
  }
}
async function refresh(full = false) {
  state = await command('state'); paired(true); playing(state.nowPlaying)
  if (full) {
    el('platform').replaceChildren()
    for (const platform of state.platforms) { const option = node('option', platform.name); option.value = platform.id; el('platform').append(option) }
    renderSources(); renderSettings()
  }
}
el('pair-form').addEventListener('submit', event => {
  event.preventDefault()
  const button = event.submitter || el('pair-form').querySelector('button')
  busy(button, async() => {
    el('pair-error').textContent = ''
    try { const result = await request('/api/pair', el('code').value.trim(), true); saveToken(result.token); el('code').value = ''; await refresh(true) } catch (error) { el('pair-error').textContent = error.message }
  })
})
el('logout').addEventListener('click', () => busy(el('logout'), async() => { await request('/api/logout', {}); saveToken(''); paired(false) }))
for (const button of document.querySelectorAll('[data-tab]')) {
  button.addEventListener('click', () => {
    for (const tab of document.querySelectorAll('[data-tab]')) tab.setAttribute('aria-selected', String(tab === button))
    for (const page of document.querySelectorAll('.page')) page.hidden = page.id !== button.dataset.tab
    if (button.dataset.tab === 'sources' || button.dataset.tab === 'settings') refresh().then(() => { renderSources(); renderSettings() }).catch(error => toast(error.message))
  })
}
for (const button of document.querySelectorAll('[data-player]')) button.addEventListener('click', () => busy(button, async() => { const result = await command('player', { action: button.dataset.player }); playing(result.nowPlaying) }))
async function search(page, fresh) {
  if (searchState.busy) return
  searchState.busy = true
  const button = el('search-form').querySelector('button'); button.disabled = true
  const query = fresh ? { text: el('query').value.trim(), source: el('platform').value } : searchState.last
  el('search-feedback').textContent = '正在搜索…'
  try {
    const result = await command('search', { ...query, page }); searchState.last = query; resultId = result.resultId
    const list = el('results'); list.replaceChildren(); list.hidden = !result.songs.length
    result.songs.forEach((song, index) => {
      const row = node('div', null, 'song-row'); const info = node('div', null, 'song-info')
      info.append(node('div', song.name, 'song-title'), node('div', [song.singer, song.interval].filter(Boolean).join(' · '), 'song-subtitle'))
      const play = node('button', '▶'); play.setAttribute('aria-label', '在电视播放 ' + song.name)
      const id = resultId
      play.addEventListener('click', () => busy(play, async() => { const data = await command('play', { resultId: id, index }); playing(data.nowPlaying); toast('已发送到电视') }))
      row.append(info, play); list.append(row)
    })
    el('search-feedback').textContent = result.songs.length ? '共 ' + result.total + ' 首 · 点击播放按钮在电视点播' : '没有找到歌曲，试试其他音乐平台或关键词。'
    el('page-info').textContent = result.songs.length ? '第 ' + result.page + ' 页' : ''
    el('prev-page').hidden = result.page <= 1
    el('next-page').hidden = result.page >= result.maxPage || !result.songs.length
    el('prev-page').onclick = () => search(result.page - 1, false)
    el('next-page').onclick = () => search(result.page + 1, false)
  } catch (error) { el('search-feedback').textContent = error.message } finally { searchState.busy = false; button.disabled = false }
}
el('search-form').addEventListener('submit', event => { event.preventDefault(); search(1, true) })
async function importing(button, payload) {
  await busy(button, async() => {
    el('source-feedback').textContent = '正在导入，请稍候…'
    try {
      const result = await command('source.import', payload); state = result; renderSources()
      el('source-feedback').textContent = '已导入「' + result.imported.name + '」，可在下方使用此源。'
      el('source-url').value = ''; el('source-file').value = ''
    } catch (error) { el('source-feedback').textContent = error.message }
  })
}
el('url-form').addEventListener('submit', event => { event.preventDefault(); importing(el('url-form').querySelector('button'), { url: el('source-url').value }) })
el('file-form').addEventListener('submit', async event => {
  event.preventDefault()
  const file = el('source-file').files[0]
  if (!file) return
  if (file.size > 4000000) { toast('请选择不超过 4 MB 的音源文件'); return }
  try { await importing(el('file-form').querySelector('button'), { script: await file.text() }) } catch (error) { toast(error.message) }
})
el('refresh-sources').addEventListener('click', () => busy(el('refresh-sources'), async() => { await refresh(); renderSources() }))
setInterval(() => {
  if (!token || document.hidden || polling) return
  polling = true
  refresh().catch(() => { el('connection').textContent = '连接中断，请检查电视应用' }).finally(() => { polling = false })
}, 4000)
if (token) refresh(true).catch(error => { toast(error.message); paired(false) })
