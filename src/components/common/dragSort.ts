export const getDragIndex = (top: number, scrollOffset: number, rowHeight: number, min: number, max: number) => {
  if (rowHeight <= 0 || max < min) return min
  return Math.max(min, Math.min(max, Math.round((top + scrollOffset) / rowHeight)))
}

export const getDragScroll = (fingerY: number, viewportHeight: number, offset: number, contentHeight: number) => {
  const edge = Math.min(56, viewportHeight / 4)
  const speed = fingerY < edge ? -Math.min(12, (edge - fingerY) / 4) : fingerY > viewportHeight - edge ? Math.min(12, (fingerY - viewportHeight + edge) / 4) : 0
  return Math.max(0, Math.min(Math.max(0, contentHeight - viewportHeight), offset + speed))
}

export const getDragShift = (index: number, from: number, to: number, height: number) => {
  if (from < to && index > from && index <= to) return -height
  if (from > to && index >= to && index < from) return height
  return 0
}

export const reorderItems = <T,>(items: readonly T[], from: number, to: number): T[] => {
  const next = [...items]
  if (from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return next
  next.splice(to, 0, next.splice(from, 1)[0])
  return next
}
