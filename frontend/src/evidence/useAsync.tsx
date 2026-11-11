import { type DependencyList, useEffect, useState } from 'react'

export type Async<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; data: T }

export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): Async<T> {
  const [state, setState] = useState<Async<T>>({ status: 'loading' })
  useEffect(() => {
    let stale = false
    setState({ status: 'loading' })
    fn().then(
      (data) => { if (!stale) setState({ status: 'ok', data }) },
      (e: Error) => { if (!stale) setState({ status: 'error', message: e.message }) },
    )
    return () => { stale = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

export function Pending({ state }: { state: Async<unknown> }) {
  if (state.status === 'error') return <div className="mut" style={{ padding: 14 }}>Không tải được dữ liệu: {state.message}</div>
  return <div className="mut" style={{ padding: 14 }}>Đang tải…</div>
}
