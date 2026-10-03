// Virtualized lines may not have measurements yet. Never let a missing height
// turn the seek marker's offset into NaN or select a non-existent lyric line.
export const getLyricLineAtOffset = (offset: number, spaceHeight: number, heights: number[], count: number) => {
  if (!count) return -1
  const measured = heights.filter(height => Number.isFinite(height) && height > 0)
  const average = measured.length ? measured.reduce((sum, height) => sum + height, 0) / measured.length : 50
  let bottom = spaceHeight
  for (let index = 0; index < count; index++) {
    const height = heights[index]
    bottom += Number.isFinite(height) && height > 0 ? height : average
    if (bottom >= offset) return index
  }
  return count - 1
}
