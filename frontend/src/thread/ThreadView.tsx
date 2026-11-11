import { useEffect, useState } from 'react'
import { getClaim, getTrace } from '../api/client'
import type { Claim, TraceGraph } from '../api/types'
import { useDemo } from '../store/demo'
import { EntityHeader } from './EntityHeader'
import { ThreadGraph } from './ThreadGraph'

export function ThreadView() {
  const claimId = useDemo((s) => s.claimId)
  const [data, setData] = useState<{ claim: Claim; trace: TraceGraph } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!claimId) return
    let stale = false
    setError(null)
    getClaim(claimId)
      .then(async (claim) => ({ claim, trace: await getTrace(claim.serial ?? '') }))
      .then((d) => { if (!stale) setData(d) })
      .catch((e: Error) => { if (!stale) setError(e.message) })
    return () => { stale = true }
  }, [claimId])

  if (error) return <div className="mut" style={{ padding: 16 }}>Không tải được thread: {error}</div>
  if (!data) return <div className="mut" style={{ padding: 16 }}>Đang tải thread…</div>
  const { claim, trace } = data
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ height: 36, flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', borderBottom: '1px solid var(--line-soft)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mut" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>As of</span>
          <input readOnly value="2026-11-03 14:05" className="mono" style={{ width: 132, height: 24, border: '1px solid var(--teal)', borderRadius: 2, padding: '0 6px', fontSize: 12, background: 'var(--teal-bg)', color: 'var(--teal-ink)' }} />
        </label>
        <span className="mut" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>thời điểm MH20-0001 được ép trên Machine 02</span>
        <span style={{ width: 1, height: 18, background: 'var(--line-soft)', margin: '0 4px' }} />
        <div role="group" aria-label="Lens" style={{ display: 'flex' }}>
          <button className="btn" style={{ background: '#1C2026', color: '#FFFFFF', borderColor: '#1C2026' }}>Lanes</button>
          <button className="btn">Table</button>
          <button className="btn">Timeline</button>
        </div>
        <span style={{ flex: 1 }} />
        <span className="mut" style={{ fontSize: 11 }}>Depth</span>
        <button className="btn">3 hops ▾</button>
      </div>
      <EntityHeader serial={trace.root} claim={claim} trace={trace} />
      <div style={{ flex: 'none', overflowX: 'auto', borderBottom: '1px solid var(--line)' }}><ThreadGraph trace={trace} /></div>
      <div id="evidence-slot" style={{ flex: 1, minHeight: 0 }} />
    </div>
  )
}
