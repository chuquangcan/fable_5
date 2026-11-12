import { getSummary } from '../api/client'
import type { FlowStage, NodeSummary, Param } from '../api/types'
import { DocList } from '../docs/DocList'
import { objectTypeLabel } from '../lib/labels'
import { useDemo } from '../store/demo'
import { STAGES } from '../thread/flowLayout'
import { useProductTab } from '../thread/ProductTabContext'
import { Pending, useAsync } from './useAsync'

/** Summary types that /api/fault-trace cannot take as an origin (not objects in the flow). */
const NOT_FAULT_ORIGIN = new Set(['aggregate', 'event', 'source'])
/** Object types the plant twin shows, so "View on plant" can select them there. */
const ON_PLANT = new Set(['receipt', 'lot', 'line', 'hopper', 'machine', 'inspection', 'shipment'])
/** Summary types a document cannot be attached to (the backend rejects them as a target). */
export const NOT_ATTACHABLE = new Set(['aggregate', 'document', 'event', 'source'])

const fmt = (p: Param) => (p.unit ? `${p.value} ${p.unit}` : String(p.value))

function Params({ params }: { params: Param[] }) {
  if (params.length === 0) return <div className="mut" style={{ padding: '8px 14px' }}>No parameters yet</div>
  return (
    <table className="g">
      <thead><tr><th>Parameter</th><th>Value</th><th>Source</th></tr></thead>
      <tbody>
        {params.map((p, i) => (
          <tr key={`${p.label}-${i}`}>
            <td>{p.label}</td>
            <td className="mono">{fmt(p)}</td>
            <td><span className="cite" title={p.source_record_id ?? undefined}>{p.source}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Overview of one node: cited params on the left, its documents on the right. */
export function OverviewBody({ d }: { d: NodeSummary }) {
  const tabId = useProductTab()
  const setFaultOrigin = useDemo((s) => s.setFaultOrigin)
  const viewOnPlant = useDemo((s) => s.viewOnPlant)
  const openAttach = useDemo((s) => s.openAttach)
  const canFault = useDemo((s) => !!tabId && !!s.product[tabId]?.claimId) && !NOT_FAULT_ORIGIN.has(d.type)
  const onPlant = !!tabId && ON_PLANT.has(d.type)
  const canAttach = !NOT_ATTACHABLE.has(d.type)
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line-faint)', overflowY: 'auto' }}>
        <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600 }}>{`${d.name} · ${objectTypeLabel(d.type)}`}</span>
          <span className="mut">{STAGES[d.stage as FlowStage] ?? d.stage}</span>
          {d.aliases.map((a) => <span key={a} className="chip" title="Merged alias">{`≡ ${a}`}</span>)}
          <span style={{ flex: 1 }} />
          {onPlant && <button className="btn" onClick={() => viewOnPlant(d.id)}>View on plant</button>}
          {canFault && tabId && <button className="btn" onClick={() => setFaultOrigin(tabId, d.id)}>Set as fault origin</button>}
        </div>
        <Params params={d.params} />
      </div>
      <div style={{ width: 340, flex: 'none', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '8px 10px 6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Documents</span>
          <span className="mut">{d.docs.length}</span>
          <span style={{ flex: 1 }} />
          {canAttach && <button className="btn" onClick={openAttach}>Attach document</button>}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {d.docs.length === 0
            ? <div className="mut" style={{ padding: '4px 14px' }}>No documents yet</div>
            : <DocList docs={d.docs} />}
        </div>
      </div>
    </div>
  )
}

export function OverviewTab({ id }: { id: string }) {
  const dataVersion = useDemo((s) => s.dataVersion)
  const s = useAsync(() => getSummary(id), [id, dataVersion])
  // Not every citable id has a summary: a 404 is "nothing to show", not a failure.
  if (s.status === 'error' && s.message.startsWith('404')) return <div className="mut" style={{ padding: 14 }}>{`No summary for ${id}`}</div>
  if (s.status !== 'ok') return <Pending state={s} />
  return <OverviewBody d={s.data} />
}
