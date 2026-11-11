import type { TraceGraph } from '../api/types'
import { type EvidenceTab, useDemo } from '../store/demo'
import { ImpactTab } from './ImpactTab'
import { LotTab } from './LotTab'
import { MachineTab } from './MachineTab'

const TABS: { id: EvidenceTab; label: string }[] = [
  { id: 'm02', label: 'Machine 02 · event 11-03' },
  { id: 'lot', label: 'LOT-B · IQC & tài liệu' },
  { id: 'impact', label: 'Khoanh vùng LOT-B' },
]
const on = { background: '#FFFFFF', color: '#1B1F24', boxShadow: 'inset 0 2px 0 #0E7C86', fontWeight: 600 }
const off = { background: 'transparent', color: '#5A616B' }

export function EvidencePanel({ trace }: { trace: TraceGraph }) {
  const tab = useDemo((s) => s.evidenceTab)
  const setEvidence = useDemo((s) => s.setEvidence)
  return (
    <div style={{ height: 406, flex: 'none', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 30, flex: 'none', display: 'flex', background: 'var(--panel)', borderBottom: '1px solid var(--line-soft)' }}>
        {TABS.map((t) => (
          <button key={t.id} className="etab" style={t.id === tab ? on : off} onClick={() => setEvidence(t.id)}>{t.label}</button>
        ))}
        <span style={{ flex: 1 }} />
        <span className="mut" style={{ fontSize: 11, alignSelf: 'center', paddingRight: 10, whiteSpace: 'nowrap' }}>Bấm node trên graph để đổi bằng chứng</span>
      </div>
      {tab === 'm02' && <MachineTab />}
      {tab === 'lot' && <LotTab trace={trace} />}
      {tab === 'impact' && <ImpactTab trace={trace} />}
    </div>
  )
}
