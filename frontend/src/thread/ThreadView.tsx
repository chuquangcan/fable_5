import { useEffect, useMemo, useRef, useState } from 'react'
import { getClaim, getFlow, getTrace } from '../api/client'
import type { Claim, FlowGraph, TraceGraph } from '../api/types'
import { useDemo } from '../store/demo'
import { EvidencePanel } from '../evidence/EvidencePanel'
import { EntityHeader } from './EntityHeader'
import { flowLayout } from './flowLayout'
import { NODE_W } from './layout'
import { ThreadGraph } from './ThreadGraph'

export function ThreadView() {
  const claimId = useDemo((s) => s.claimId)
  const mode = useDemo((s) => s.mode)
  const setMode = useDemo((s) => s.setMode)
  const focusNodeId = useDemo((s) => s.focusNodeId)
  const [data, setData] = useState<{ claim: Claim; trace: TraceGraph; flow: FlowGraph } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const graphRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!claimId) return
    let stale = false
    setError(null)
    Promise.all([
      getClaim(claimId).then(async (claim) => ({ claim, trace: await getTrace(claim.serial ?? '') })),
      getFlow(claimId),
    ])
      .then(([ct, flow]) => ({ ...ct, flow }))
      .then((d) => { if (!stale) setData(d) })
      .catch((e: Error) => { if (!stale) setError(e.message) })
    return () => { stale = true }
  }, [claimId])

  const layout = useMemo(() => (data ? flowLayout(data.flow) : null), [data])
  // Keep the focused node in view: the graph is wider than the main area and scrolls horizontally.
  useEffect(() => {
    const el = graphRef.current
    const p = layout?.nodes.find((n) => n.id === focusNodeId)
    if (!el || !p) return
    if (p.x < el.scrollLeft || p.x + NODE_W > el.scrollLeft + el.clientWidth)
      el.scrollTo?.({ left: Math.max(0, p.x + NODE_W / 2 - el.clientWidth / 2), behavior: 'smooth' })
  }, [focusNodeId, layout])

  if (error) return <div className="mut" style={{ padding: 16 }}>Không tải được thread: {error}</div>
  if (!data) return <div className="mut" style={{ padding: 16 }}>Đang tải thread…</div>
  const { claim, trace, flow } = data
  const fault = mode === 'fault'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ height: 36, flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', borderBottom: '1px solid var(--line-soft)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mut" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>As of</span>
          <input readOnly value="2026-11-03 14:05" className="mono" style={{ width: 132, height: 24, border: '1px solid var(--teal)', borderRadius: 2, padding: '0 6px', fontSize: 12, background: 'var(--teal-bg)', color: 'var(--teal-ink)' }} />
        </label>
        <span className="mut" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>thời điểm MH20-0001 được ép trên Machine 02</span>
        <span style={{ width: 1, height: 18, background: 'var(--line-soft)', margin: '0 4px' }} />
        <span style={{ flex: 1 }} />
        <button
          className={fault ? 'btn pri' : 'btn'}
          aria-pressed={fault}
          onClick={() => setMode(fault ? 'normal' : 'fault')}
          title="Bật để tô đường truy lỗi trên thread"
        >
          Truy lỗi
        </button>
      </div>
      <EntityHeader serial={trace.root} claim={claim} trace={trace} />
      <div ref={graphRef} data-testid="graph-scroll" style={{ flex: 'none', overflowX: 'auto', borderBottom: '1px solid var(--line)' }}><ThreadGraph flow={flow} /></div>
      <EvidencePanel trace={trace} />
    </div>
  )
}
