import { type DependencyList, useEffect, useState } from 'react'

export type Async<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string; retry?: () => void }
  | { status: 'ok'; data: T; key?: string }

/** Runs `fn` when `deps` change; an error state carries `retry` to run it again.
 *  With `keepKey`, a refetch under the same key keeps the last data on screen instead of going back to loading
 *  (a data write refetches the open node without unmounting its tab). */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList, keepKey?: string): Async<T> {
  const [state, setState] = useState<Async<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let stale = false
    setState((prev) => (prev.status === 'ok' && keepKey !== undefined && prev.key === keepKey ? prev : { status: 'loading' }))
    fn().then(
      (data) => { if (!stale) setState({ status: 'ok', data, key: keepKey }) },
      (e: Error) => { if (!stale) setState({ status: 'error', message: e.message, retry: () => setAttempt((a) => a + 1) }) },
    )
    return () => { stale = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt])
  return state
}

/** Grey placeholder bars while a panel loads. */
export function Skeleton({ rows = 4, label = 'Loading…' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skel" style={{ width: `${90 - ((i * 17) % 40)}%` }} />)}
    </div>
  )
}

export function Pending({ state }: { state: Async<unknown> }) {
  if (state.status === 'error')
    return (
      <div role="alert" style={{ padding: 14, color: 'var(--red-ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Could not load data: {state.message}</span>
        {state.retry && <button className="btn" onClick={state.retry}>Retry</button>}
      </div>
    )
  return <Skeleton />
}
