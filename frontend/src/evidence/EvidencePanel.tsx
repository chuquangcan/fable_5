import { getSummary } from '../api/client'
import { type EvidenceTab, useDemo } from '../store/demo'
import { EventsTab } from './EventsTab'
import { ImpactTab } from './ImpactTab'
import { LotTab } from './LotTab'
import { MachineTab } from './MachineTab'
import { OverviewBody } from './OverviewTab'
import { lotOf, tabsFor } from './tabs'
import { Pending, useAsync } from './useAsync'

/** Detail panel for one node, shared by the product (thread) and plant views. */
export function EvidencePanel({ nodeId }: { nodeId: string }) {
  const dataVersion = useDemo((s) => s.dataVersion)
  const wanted = useDemo((s) => s.evidenceTab)
  const setEvidence = useDemo((s) => s.setEvidence)
  // keyed by node: a refetch after a data write keeps the open tab mounted (no flicker, no double fetch)
  const s = useAsync(() => getSummary(nodeId), [nodeId, dataVersion], nodeId)

  if (s.status === 'error' && s.message.startsWith('404'))
    return <div className="mut" style={{ padding: 14 }}>{`Không có tổng hợp cho ${nodeId}`}</div>
  const tabs = s.status === 'ok' ? tabsFor(s.data) : [{ id: 'overview' as EvidenceTab, label: 'Tổng quan' }]
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
          {tab === 'machine' && <MachineTab machineId={nodeId} />}
          {tab === 'lot' && <LotTab lotId={nodeId} />}
          {tab === 'impact' && <ImpactTab lot={lotOf(nodeId)} />}
        </>
      )}
    </div>
  )
}
