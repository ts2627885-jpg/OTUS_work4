import { importAPI } from '@/api/import'
import { useRequest, useMutation } from '@/composables/useRequest'

/**
 * Импорт данных: история загрузок, сводка по датам и отправка CSV-файлов.
 *
 * const { history, loadHistory, upload, uploadState, summary, loadSummary } = useImport()
 */
export function useImport() {
  const historyState = useRequest(() => importAPI.history().then(r => r.data.data), [])
  const summaryState = useRequest(() => importAPI.summary().then(r => r.data.data), null)
  const uploadState = useMutation((files) => {
    const fd = new FormData()
    for (const f of files) fd.append('file', f)
    return importAPI.upload(fd).then(r => r.data.data)
  })

  // Отправка файлов; после неё история обновляется в любом случае (успех или ошибка)
  const upload = async (files) => {
    try {
      return await uploadState.run(files)
    } finally {
      await historyState.run()
    }
  }

  return {
    history: historyState.data,
    historyError: historyState.error,
    loadHistory: historyState.run,
    summary: summaryState.data,
    summaryLoading: summaryState.loading,
    summaryError: summaryState.error,
    loadSummary: summaryState.run,
    upload,
    uploadState,
  }
}
