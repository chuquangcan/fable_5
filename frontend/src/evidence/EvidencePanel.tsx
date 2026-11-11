import { getSummary } from '../api/client'
import type { NodeSummary, TraceGraph } from '../api/types'
import { type EvidenceTab, useDemo } from '../store/demo'
import { EventsTab } from './EventsTab'
import { ImpactTab } from './ImpactTab'
import { LotTab } from './LotTab'
import { MachineTab } from './MachineTab'
import { OverviewBody } from './OverviewTab'
import { Pending, useAsync } from './useAsync'

/** The deep tabs are written around the demo story, so they are offered only on the nodes they describe. */
const STORY_MACHINE = 'M02'
const STORY_LOTS = new Set(['LOT-A', 'LOT-B', 'IQC-5507', 'IQC-5531', 'AGG-LOT-B'])

/** Tabs a node offers, from its summary type: one place instead of a fixed tab set (improve.md §3). */
export function tabsFor(id: string, s: NodeSummary): { id: EvidenceTab; label: string }[] {
  const tabs: { id: EvidenceTab; label: string }[] = [{ id: 'overview', label: 'Tổng quan' }]
  if (s.counts.events > 0) tabs.push({ id: 'events', label: `Sự kiện · ${s.counts.events.toLocaleString('en-US')}` })
  if (id === STORY_MACHINE) tabs.push({ id: 'm02', label: 'Chu kỳ ép 11-03' })
  if (STORY_LOTS.has(id) && s.type !== 'aggregate') tabs.push({ id: 'lot', label: 'IQC · so sánh lô' })
  if (s.type === 'lot' || s.type === 'aggregate') tabs.push({ id: 'impact', label: 'Khoanh vùng' })
  return tabs
}

const lotOf = (id: string) => id.replace(/^AGG-/, '')

/** Detail panel for one node, shared by the product (thread) and plant views. */
export function EvidencePanel({ nodeId, trace }: { nodeId: string; trace?: TraceGraph }) {
  const dataVersion = useDemo((s) => s.dataVersion)
  const wanted = useDemo((s) => s.evidenceTab)
  const setEvidence = useDemo((s) => s.setEvidence)
  const s = useAsync(() => getSummary(nodeId), [nodeId, dataVersion])

  if (s.status === 'error' && s.message.startsWith('404'))
    return <div className="mut" style={{ padding: 14 }}>{`Không có tổng hợp cho ${nodeId}`}</div>
  const tabs = s.status === 'ok' ? tabsFor(nodeId, s.data) : [{ id: 'overview' as EvidenceTab, label: 'Tổng quan' }]
  const tab = tabs.some((t) => t.id === wanted) ? wanted : 'overview'
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div role="tablist" aria-label={`Chi tiết ${nodeId}`} className="etabs">
        <span className="mono etab-id" title="Node đang xem">{nodeId}</span>
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={t.id === tab} className={`etab${t.id === tab ? ' on' : ''}`} onClick={() => setEvidence(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {s.status !== 'ok' ? <Pending state={s} /> : (
        <>
          {tab === 'overview' && <OverviewBody d={s.data} />}
          {tab === 'events' && <EventsTab id={nodeId} />}
          {tab === 'm02' && <MachineTab />}
          {tab === 'lot' && <LotTab trace={trace} />}
          {tab === 'impact' && <ImpactTab trace={trace} lot={lotOf(nodeId)} />}
        </>
      )}
    </div>
  )
}
