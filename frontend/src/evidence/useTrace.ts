import { getTrace } from '../api/client'
import type { TraceGraph } from '../api/types'
import { useDemo } from '../store/demo'
import { useAsync } from './useAsync'

/** The demo's story serial: the IQC / impact tabs are written around its thread. */
export const STORY_SERIAL = 'MH20-0001'

/** The given trace, else the trace of the open thread (or the story serial when opened from the plant view). */
export function useTrace(trace?: TraceGraph): TraceGraph | null {
  const root = useDemo((s) => s.threadRoot) ?? STORY_SERIAL
  const s = useAsync(() => (trace ? Promise.resolve(trace) : getTrace(root)), [trace, root])
  return s.status === 'ok' ? s.data : null
}
