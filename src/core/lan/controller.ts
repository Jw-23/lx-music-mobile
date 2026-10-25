export const remoteSettings = [
  { key: 'player.loudnessNormalize', label: '统一响度', type: 'boolean' },
  { key: 'player.volume', label: '播放器音量（%）', type: 'number', min: 0, max: 1 },
  { key: 'player.startupAutoPlay', label: '启动后自动播放', type: 'boolean' },
  { key: 'player.startupPushPlayDetailScreen', label: '启动后进入播放页', type: 'boolean' },
  { key: 'common.autoHidePlayBar', label: '输入时隐藏播放栏', type: 'boolean' },
  { key: 'common.showBackBtn', label: '显示返回按钮', type: 'boolean' },
  { key: 'common.showExitBtn', label: '显示退出按钮', type: 'boolean' },
  { key: 'player.isSavePlayTime', label: '记住播放进度', type: 'boolean' },
  { key: 'player.isShowLyricTranslation', label: '显示歌词翻译', type: 'boolean' },
  { key: 'player.isShowLyricRoma', label: '显示歌词音译', type: 'boolean' },
  { key: 'list.isShowAlbumName', label: '列表显示专辑', type: 'boolean' },
  { key: 'list.isShowSource', label: '列表显示音乐平台', type: 'boolean' },
  { key: 'search.isShowHistorySearch', label: '保存搜索历史', type: 'boolean' },
  { key: 'search.isShowHotSearch', label: '显示热门搜索', type: 'boolean' },
  { key: 'player.togglePlayMethod', label: '播放模式', type: 'select', options: [['listLoop', '列表循环'], ['list', '顺序播放'], ['random', '随机播放'], ['singleLoop', '单曲循环'], ['none', '播放后停止']] },
  { key: 'player.playQuality', label: '播放音质', type: 'select', options: [['128k', '标准'], ['320k', '高品质'], ['flac', '无损'], ['flac24bit', 'Hi-Res']] },
  { key: 'playDetail.style.align', label: '歌词对齐', type: 'select', options: [['left', '左对齐'], ['center', '居中'], ['right', '右对齐']] },
  { key: 'playDetail.horizontal.style.lrcFontSize', label: '横屏歌词字号', type: 'number', min: 100, max: 400 },
] as const
interface Source { id: string, name: string, version?: string, description?: string }
interface Song { id: string, name: string, singer: string, interval: string | null, source: string }
export interface LanDependencies {
  settings: () => LX.AppSetting
  updateSettings: (value: Partial<LX.AppSetting>) => void
  sources: () => Source[]
  selectedSource: () => { id: string, ready: boolean, message?: string }
  importScript: (script: string) => Promise<Source>
  download: (url: string) => Promise<string>
  useSource: (id: string) => Promise<void>
  platforms: () => Array<{ id: string, name: string }>
  search: (text: string, source: string, page: number) => Promise<{ list: Song[], total: number, maxPage: number }>
  play: (song: Song) => Promise<void>
  player: (action: string) => Promise<void>
  nowPlaying: () => unknown
  now: () => number
}
export class LanCommandError extends Error { constructor(public status: number, message: string) { super(message) } }
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LanCommandError(400, '请求格式无效')
  return value as Record<string, unknown>
}
export const createLanController = (d: LanDependencies) => {
  let mutation: Promise<unknown> = Promise.resolve()
  let sequence = 0
  const results = new Map<string, { songs: Song[], expires: number }>()
  let searching = 0
  const snapshot = () => ({
    settings: remoteSettings.map(spec => ({ ...spec, value: d.settings()[spec.key] })),
    sources: d.sources(),
    selectedSource: d.selectedSource(),
    platforms: d.platforms(),
    nowPlaying: d.nowPlaying(),
  })
  const execute = async(action: string, p: Record<string, unknown>) => {
    switch (action) {
      case 'state': return snapshot()
      case 'settings.set': {
        const spec = remoteSettings.find(item => item.key === p.key)
        if (!spec) throw new LanCommandError(400, '此设置不支持远程修改')
        const value = p.value
        if (spec.type === 'boolean' ? typeof value !== 'boolean' : spec.type === 'number' ? typeof value !== 'number' || !Number.isFinite(value) || value < spec.min || value > spec.max : !spec.options.some(option => option[0] === value)) throw new LanCommandError(400, '设置值无效')
        d.updateSettings({ [spec.key]: value })
        return snapshot()
      }
      case 'source.import': {
        let script: string
        if (typeof p.url === 'string') {
          const url = p.url.trim()
          if (url.length > 4096 || !/^https?:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i.test(url)) throw new LanCommandError(400, '请输入有效的 HTTP 或 HTTPS 链接')
          script = await d.download(url)
        } else if (typeof p.script === 'string') script = p.script
        else throw new LanCommandError(400, '请选择音源文件或填写链接')
        if (script.length > 4000000 || !/^\/\*[\s\S]+?\*\//.test(script)) throw new LanCommandError(400, '音源格式无效或文件超过 4 MB')
        const imported = await d.importScript(script)
        return { imported, ...snapshot() }
      }
      case 'source.use': {
        if (typeof p.id !== 'string' || !d.sources().some(source => source.id === p.id)) throw new LanCommandError(400, '音源不存在，请刷新后重试')
        await d.useSource(p.id)
        return snapshot()
      }
      case 'search': {
        if (typeof p.text !== 'string' || !p.text.trim() || p.text.length > 120 || !d.platforms().some(platform => platform.id === p.source)) throw new LanCommandError(400, '请填写歌名或歌手，并选择音乐平台')
        const page = p.page ?? 1
        if (typeof page !== 'number' || !Number.isInteger(page) || page < 1 || page > 100) throw new LanCommandError(400, '页码无效')
        if (searching >= 2) throw new LanCommandError(429, '正在搜索，请稍后再试')
        searching++
        try {
          const found = await d.search(p.text.trim(), p.source as string, page)
          for (const [key, item] of results) if (item.expires <= d.now()) results.delete(key)
          while (results.size >= 8) results.delete(results.keys().next().value!)
          const id = String(++sequence)
          const songs = found.list.slice(0, 30)
          results.set(id, { songs, expires: d.now() + 10 * 60 * 1000 })
          return { resultId: id, page, total: found.total, maxPage: found.maxPage, songs: songs.map(({ id, name, singer, interval, source }) => ({ id, name, singer, interval, source })) }
        } finally { searching-- }
      }
      case 'play': {
        const found = typeof p.resultId === 'string' ? results.get(p.resultId) : undefined
        if (!found || found.expires <= d.now() || typeof p.index !== 'number' || !Number.isInteger(p.index) || !found.songs[p.index]) throw new LanCommandError(410, '搜索结果已过期，请重新搜索')
        await d.play(found.songs[p.index])
        return { nowPlaying: d.nowPlaying() }
      }
      case 'player': {
        if (!['toggle', 'next', 'previous', 'forward', 'rewind'].includes(String(p.action))) throw new LanCommandError(400, '播放操作无效')
        await d.player(p.action as string)
        return { nowPlaying: d.nowPlaying() }
      }
      default: throw new LanCommandError(404, '操作不存在')
    }
  }
  return async(input: unknown, deadline: number) => {
    const request = object(input)
    if (typeof request.action !== 'string') throw new LanCommandError(400, '缺少操作名称')
    const action = request.action
    const payload = request.payload == null ? {} : object(request.payload)
    const run = async() => {
      if (!Number.isFinite(deadline) || d.now() >= deadline) throw new LanCommandError(408, '请求已过期，请重试')
      return execute(action, payload)
    }
    if (action === 'state' || action === 'search') return run()
    const task = mutation.then(run)
    mutation = task.catch(() => {})
    return task
  }
}
