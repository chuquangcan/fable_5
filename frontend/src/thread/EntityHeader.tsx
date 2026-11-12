import type { Claim, TraceGraph } from '../api/types'
import { useDemo } from '../store/demo'
import { useProductTab } from './ProductTabContext'

function monthsBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000 / 30)
}

/** One header row for the thread: what is on screen (serial, claim, as-of) and what can be done with it. */
export function EntityHeader({ serial, claim, trace, asOf }: { serial: string; claim: Claim | null; trace: TraceGraph; asOf: string }) {
  const tabId = useProductTab() ?? ''
  const mode = useDemo((s) => s.product[tabId]?.mode ?? 'normal')
  const setMode = (m: 'normal' | 'fault') => useDemo.getState().setMode(tabId, m)
  const faultOrigin = useDemo((s) => s.product[tabId]?.faultOrigin ?? null)
  const setFaultOrigin = (id: string | null) => useDemo.getState().setFaultOrigin(tabId, id)
  const openAttach = useDemo((s) => s.openAttach)
  const shipment = trace.nodes.find((n) => n.type === 'shipment')
  const date = (shipment?.attributes.date as string | undefined) ?? null
  const customer = trace.nodes.find((n) => n.type === 'customer')?.name ?? null
  const used = date && claim?.received ? monthsBetween(date, claim.received) : null
  const to = claim?.customer_name ?? customer
  const sub = ['MH-20 water pump', to && date ? `shipped to ${to} on ${date}` : null, used ? `in use for ${used} months` : null]
    .filter(Boolean).join(' · ')
  const lot = trace.edges.find((e) => e.from_id === serial && e.relation === 'uses_lot')?.to_id
  const fault = !!claim && mode === 'fault'
  const showImpact = () => {
    if (!lot) return
    useDemo.getState().selectNode(tabId, lot)
    useDemo.getState().setEvidence(tabId, 'impact')
  }
  return (
    <div className="entity">
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className="mono" style={{ fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap' }}>{serial}</span>
          {claim && <span className="chip red claimchip" title={claim.symptom ?? undefined}><span className="ellipsis">{`${claim.id} · ${claim.symptom ?? 'claim'}`}</span></span>}
        </div>
        <span className="mut ellipsis">{sub}</span>
      </div>
      <span className="chip thr asof" title={`When ${serial} was pressed — every link is evaluated as of this moment`}>
        <span className="mut">As of</span><span className="mono">{asOf}</span>
      </span>
      {fault && faultOrigin && (
        <span className="chip red" style={{ flex: 'none' }}>
          <span>{`Fault origin: ${faultOrigin}`}</span>
          <button className="xbtn" aria-label="Back to the claim's fault origin" title="Back to the claim's fault origin" onClick={() => setFaultOrigin(null)}>✕</button>
        </span>
      )}
      <span className="vsep" />
      {claim && (
        // fault colouring belongs to a claim: a thread opened by serial shows the plain thread
        <button
          className={fault ? 'btn pri' : 'btn'} aria-pressed={fault} onClick={() => setMode(fault ? 'normal' : 'fault')}
          title="Highlight the fault origin and upstream in red, and possibly affected downstream in orange"
        >
          Trace fault
        </button>
      )}
      {lot && <button className="btn" onClick={showImpact} title={`Impact scope of ${lot}`}>Impact scope</button>}
      <button className="btn" onClick={openAttach}>Attach document</button>
    </div>
  )
}
