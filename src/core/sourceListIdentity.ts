// Old collectors sometimes compared a source-prefixed ID while storing the raw
// remote ID. Accept either form without mixing playlists from different sources.
export const normalizeSourceListId = (source: LX.OnlineSource, id: string) => {
  const value = String(id)
  return value.startsWith(`${source}__`) ? value.slice(source.length + 2) : value
}
export const isSameSourceList = (list: { id?: string, source?: LX.OnlineSource, sourceListId?: string }, source: LX.OnlineSource, id: string) =>
  list.source === source && !!list.sourceListId && normalizeSourceListId(source, list.sourceListId) === normalizeSourceListId(source, id)
