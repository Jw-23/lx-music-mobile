import { importUserApi } from '@/core/userApi'
import { readFile } from '@/utils/fs'
import { log } from '@/utils/log'
import { toast } from '@/utils/tools'
import { isSourceScript } from './importFlow'

// Shared-file/deep-link imports retain their existing entry point.
export const handleImportLocalFile = (path: string) => {
  void readFile(path).then(async script => {
    if (!isSourceScript(script)) throw new Error(global.i18n.t('user_api_add_failed_tip'))
    await importUserApi(script)
    toast(global.i18n.t('user_api_import_success_tip'))
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    log.error(message)
    toast(global.i18n.t('user_api_import_failed_tip', { message }), 'long')
  })
}
