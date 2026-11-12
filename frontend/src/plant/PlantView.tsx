import { EvidencePanel } from '../evidence/EvidencePanel'
import { useDemo } from '../store/demo'

export const DEFAULT_ASSET = 'M02'

/** Asset-centric view: one plant asset with the same detail panel as a thread node, no claim needed. */
export function PlantView() {
  const id = useDemo((s) => s.plantAsset) ?? DEFAULT_ASSET
  const onThread = useDemo((s) => !!s.claimId && s.threadIds.includes(id))
  const goTo = useDemo((s) => s.goTo)
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="viewbar">
        <span style={{ fontWeight: 600 }}>Plant</span>
        <span className="mut">· assets over time, no claim needed</span>
        <span style={{ flex: 1 }} />
        {onThread && (
          <button className="btn" onClick={() => goTo(id)} title="Open this node on the open claim's thread">View on thread</button>
        )}
      </div>
      <EvidencePanel nodeId={id} />
    </div>
  )
}
