import { getPlantOverview } from '../api/client'
import { useAsync } from '../evidence/useAsync'
import { useDemo } from '../store/demo'

/** The overview at the demo clock, reloaded when the clock or the data changes. */
export function usePlantOverview() {
  const asOf = useDemo((s) => s.asOf)
  const dataVersion = useDemo((s) => s.dataVersion)
  return useAsync(() => getPlantOverview(asOf), [asOf, dataVersion])
}

export const secs = (v: number | null) => (v == null ? '—' : `${Math.round(v * 10) / 10} s`)
export const count = (n: number) => (n ? n.toLocaleString('en-US') : '—')
