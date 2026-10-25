// Independent of phone font scaling and display density; React Native uses dp here.
export const TV_LAYOUT = { edgeX: 28, edgeY: 18, header: 58, button: 48, playButton: 58, icon: 23, playIcon: 27, radius: 16 } as const
export const getTVArtworkSize = (width: number, height: number) => Math.max(72, Math.min(300, width * 0.28, height - 300))
