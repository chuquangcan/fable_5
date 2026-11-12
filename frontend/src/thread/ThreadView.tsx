import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getClaim, getClaimFault, getFault, getFlow, getTrace } from '../api/client'
import type { Claim, FaultTrace, FlowGraph, TraceGraph } from '../api/types'
import { useDemo } from '../store/demo'
import { EvidencePanel } from '../evidence/EvidencePanel'
import { Skeleton } from '../evidence/useAsync'
import { EntityHeader } from './EntityHeader'
import { flowLayout } from './flowLayout'
import { NODE_W } from './layout'
import { formatPlantTime } from '../lib/time'
import { ThreadGraph } from './ThreadGraph'

export function ThreadView() {
  const claimId = useDemo((s) => s.claimId)
  const mode = useDemo((s) => s.mode)
  const focusNodeId = useDemo((s) => s.focusNodeId)
  const faultOrigin = useDemo((s) => s.faultOrigin)
  const dataVersion = useDemo((s) => s.dataVersion)
  const setThreadRoot = useDemo((s) => s.setThreadRoot)
  const setThreadIds = useDemo((s) => s.setThreadIds)
  const [fit, setFit] = useState(false)
  const [boxWidth, setBoxWidth] = useState(0)
  const [faultData, setFaultData] = useState<{ claimId: string; origin: string | null; trace: FaultTrace } | null>(null)
  const [faultError, setFaultError] = useState(false)
  const [data, setData] = useState<{ claim: Claim; trace: TraceGraph; flow: FlowGraph } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
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
  }, [claimId, attempt])

  const root = data?.flow.root ?? null
  useEffect(() => { setThreadRoot(root) }, [root, setThreadRoot])

  // A write (e.g. an attachment) refetches just the flow; the initial load above already covers version 0 / claim changes.
  const seenVersion = useRef(dataVersion)
  useEffect(() => {
    if (seenVersion.current === dataVersion) return
    seenVersion.current = dataVersion
    if (!claimId) return
    let stale = false
    getFlow(claimId)
      .then((flow) => { if (!stale) setData((d) => (d ? { ...d, flow } : d)) })
      .catch(() => {})
    return () => { stale = true }
  }, [claimId, dataVersion])

  // Fault colouring: the claim's own fault gives the reference time; an explicit origin is traced at that time
  // on this claim's thread (the backend resolves the claim to the same root serial as /api/flow), so the
  // thread's own serial/box are kept rather than collapsed into the lot aggregate.
  useEffect(() => {
    if (!claimId || mode !== 'fault') { setFaultError(false); return }
    let stale = false
    setFaultError(false)
    setFaultData(null)
    getClaimFault(claimId)
      .then((cf) => (faultOrigin ? getFault(faultOrigin, cf.at, claimId) : cf))
      .then((trace) => { if (!stale) setFaultData({ claimId, origin: faultOrigin, trace }) })
      .catch(() => { if (!stale) setFaultError(true) })
    return () => { stale = true }
  }, [claimId, mode, faultOrigin])

  const { marks, reasons } = useMemo(() => {
    if (mode !== 'fault' || !faultData || faultData.claimId !== claimId || faultData.origin !== faultOrigin) return { marks: undefined, reasons: undefined }
    const t = faultData.trace
    const marks: Record<string, 'red' | 'orange'> = {}
    const reasons: Record<string, string> = {}
    for (const [list, tone] of [[t.orange, 'orange'], [t.red, 'red']] as const)
      for (const m of list) { marks[m.id] = tone; reasons[m.id] = m.reason }
    return { marks, reasons }
  }, [mode, faultData, claimId, faultOrigin])

  const layout = useMemo(() => (data ? flowLayout(data.flow) : null), [data])
  useEffect(() => {
    if (data) setThreadIds([...data.flow.spine, ...data.flow.branches].map((n) => n.id))
  }, [data, setThreadIds])
  // Width available to the graph, for "fit to width".
  useLayoutEffect(() => {
    const el = graphRef.current
    if (!el) return
    setBoxWidth(el.clientWidth)
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [layout])
  const scale = fit && layout && boxWidth > 0 ? Math.min(1, boxWidth / layout.width) : 1
  // Keep the focused node in view: the graph is wider than the main area and scrolls horizontally.
  useEffect(() => {
    const el = graphRef.current
    const p = layout?.nodes.find((n) => n.id === focusNodeId)
    if (!el || !p || fit) return
    if (p.x < el.scrollLeft || p.x + NODE_W > el.scrollLeft + el.clientWidth)
      el.scrollTo?.({ left: Math.max(0, p.x + NODE_W / 2 - el.clientWidth / 2), behavior: 'smooth' })
  }, [focusNodeId, layout, fit])

  if (error)
    return (
      <div role="alert" style={{ padding: 16, color: 'var(--red-ink)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span>Could not load thread: {error}</span>
        <button className="btn" onClick={() => setAttempt((a) => a + 1)}>Retry</button>
      </div>
    )
  if (!data) return <Skeleton rows={6} label="Loading thread…" />
  const { claim, trace, flow } = data
  const overflows = !!layout && boxWidth > 0 && layout.width > boxWidth
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <EntityHeader serial={trace.root} claim={claim} trace={trace} asOf={formatPlantTime(flow.at, 'YYYY-MM-DD HH:mm')} />
      {mode === 'fault' && faultError && <div role="alert" className="banner red">Could not load fault-trace data</div>}
      <div style={{ position: 'relative', flex: 'none', borderBottom: '1px solid var(--line)' }}>
        <div ref={graphRef} data-testid="graph-scroll" style={{ overflowX: fit ? 'hidden' : 'auto' }}>
          {layout && scale < 1 ? (
            <div style={{ width: layout.width * scale, height: layout.height * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }}>
                <ThreadGraph flow={flow} marks={marks} reasons={reasons} />
              </div>
            </div>
          ) : <ThreadGraph flow={flow} marks={marks} reasons={reasons} />}
        </div>
        {(overflows || fit) && (
          <button className="btn graph-fit" aria-pressed={fit} onClick={() => setFit(!fit)} title={fit ? 'Show actual size, scroll horizontally' : 'Shrink to fit the frame'}>
            {fit ? 'Actual size' : 'Fit to frame'}
          </button>
        )}
      </div>
      <EvidencePanel nodeId={focusNodeId ?? trace.root} />
    </div>
  )
}
