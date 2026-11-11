import { getReviewQueue } from '../api/client'
import { useAsync } from '../evidence/useAsync'
import { useDemo } from '../store/demo'

/** Number of links waiting for a person (refetched after every demo write). */
export function useReviewCount(): number | null {
  const dataVersion = useDemo((s) => s.dataVersion)
  const s = useAsync(getReviewQueue, [dataVersion])
  return s.status === 'ok' ? s.data.pending.length : null
}
