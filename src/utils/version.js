import { httpGet } from '@/utils/request'
import { RELEASE_API_URL } from '@/config/release'
import { parseRelease, selectReleaseAsset } from './releaseModel'
import { downloadFile, stopDownload, temporaryDirectoryPath } from '@/utils/fs'
import { getSupportedAbis, installApk } from '@/utils/nativeModules/utils'
import { APP_PROVIDER_NAME } from '@/config/constant'

const request = async(url) => {
  return new Promise((resolve, reject) => {
    httpGet(url, {
      timeout: 10000,
      headers: { Accept: 'application/vnd.github+json' },
    }, (err, resp, body) => {
      if (err || resp?.statusCode != 200) {
        reject(err || new Error(resp?.statusMessage || String(resp?.statusCode)))
      } else resolve(body)
    })
  })
}

let checkedRelease = null
export const getVersionInfo = async() => {
  const [release, history] = await Promise.all([
    request(`${RELEASE_API_URL}/latest`),
    request(`${RELEASE_API_URL}?per_page=10`).catch(() => []),
  ])
  const info = parseRelease(release)
  checkedRelease = release
  info.history = (Array.isArray(history) ? history : []).filter(item => item?.tag_name !== release.tag_name).flatMap(item => {
    try { return [parseRelease(item)] } catch { return [] }
  })
  return info
}

let downloadJobId = null
const noop = (total, download) => {}
let apkSavePath

export const downloadNewVersion = async(version, onDownload = noop) => {
  const release = checkedRelease && parseRelease(checkedRelease).version === version
    ? checkedRelease
    : await request(`${RELEASE_API_URL}/tags/v${version}`)
  if (parseRelease(release).version !== version) throw new Error('Release version mismatch')
  const url = selectReleaseAsset(release, await getSupportedAbis())
  let savePath = temporaryDirectoryPath + '/lx-music-mobile.apk'

  if (downloadJobId) stopDownload(downloadJobId)
  apkSavePath = null

  const { jobId, promise } = downloadFile(url, savePath, {
    progressInterval: 500,
    connectionTimeout: 20000,
    readTimeout: 30000,
    begin({ contentLength }) {
      onDownload(contentLength, 0)
    },
    progress({ contentLength, bytesWritten }) {
      onDownload(contentLength, bytesWritten)
    },
  })
  downloadJobId = jobId
  return promise.then(({ statusCode, bytesWritten }) => {
    if (statusCode !== 200 || bytesWritten <= 0) throw new Error('APK download failed')
    downloadJobId = null
    apkSavePath = savePath
    return updateApp()
  })
}

export const updateApp = async() => {
  if (!apkSavePath) throw new Error('apk Save Path is null')
  await installApk(apkSavePath, APP_PROVIDER_NAME)
}
