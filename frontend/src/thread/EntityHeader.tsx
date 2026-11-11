import type { Claim, TraceGraph } from '../api/types'
import { useDemo } from '../store/demo'

function monthsBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000 / 30)
}

export function EntityHeader({ serial, claim, trace }: { serial: string; claim: Claim; trace: TraceGraph }) {
  const setEvidence = useDemo((s) => s.setEvidence)
  const shipment = trace.nodes.find((n) => n.type === 'shipment')
  const date = (shipment?.attributes.date as string | undefined) ?? null
  const used = date && claim.received ? monthsBetween(date, claim.received) : null
  const sub = ['Bơm nước MH-20', claim.customer_name && date ? `giao ${claim.customer_name} ngày ${date}` : null, used ? `đã dùng ${used} tháng` : null]
    .filter(Boolean).join(' · ')
  return (
    <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', borderBottom: '1px solid var(--line-faint)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 120, flex: '1 1 auto' }}>
        <span className="mono" style={{ fontSize: 18, fontWeight: 600, whiteSpace: 'nowrap' }}>{serial}</span>
        <span className="mut" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
      </div>
      <span className="chip red" style={{ flex: 'none' }}>{claim.id} · tiếng ồn bất thường</span>
      <span className="chip hide-narrow" style={{ flex: 'none' }}>7 hệ thống · 16 bản ghi</span>
      <button className="btn" style={{ flex: 'none' }} onClick={() => void navigator.clipboard?.writeText(window.location.href)}>Copy thread link</button>
      <button className="btn" style={{ flex: 'none' }} onClick={() => setEvidence('impact')}>Khoanh vùng</button>
    </div>
  )
}
