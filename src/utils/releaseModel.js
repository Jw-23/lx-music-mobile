import { RELEASE_URL } from '@/config/release'

export const parseRelease = release => {
  const match = /^v?(\d+\.\d+\.\d+)$/.exec(release?.tag_name ?? '')
  if (!match || release.draft || release.prerelease || !release.published_at) throw new Error('No published stable release')
  return { version: match[1], desc: (release.body ?? '').replace(/^#{1,6}\s+/gm, ''), history: [] }
}

export const selectReleaseAsset = (release, supportedAbis) => {
  parseRelease(release)
  const prefix = `lx-music-mobile-${release.tag_name}-`
  for (const abi of [...supportedAbis, 'universal']) {
    const asset = release.assets?.find(asset => asset.name === `${prefix}${abi}.apk` && asset.state === 'uploaded' && asset.size > 0)
    if (asset?.browser_download_url?.startsWith(`${RELEASE_URL}/download/${release.tag_name}/`)) return asset.browser_download_url
  }
  throw new Error('No compatible APK in this release')
}
