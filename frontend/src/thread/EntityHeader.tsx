import type { Claim, TraceGraph } from '../api/types'
import { useDemo } from '../store/demo'

function monthsBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000 / 30)
}

/** One header row for the thread: what is on screen (serial, claim, as-of) and what can be done with it. */
export function EntityHeader({ serial, claim, trace, asOf }: { serial: string; claim: Claim; trace: TraceGraph; asOf: string }) {
  const mode = useDemo((s) => s.mode)
  const setMode = useDemo((s) => s.setMode)
  const faultOrigin = useDemo((s) => s.faultOrigin)
  const setFaultOrigin = useDemo((s) => s.setFaultOrigin)
  const openAttach = useDemo((s) => s.openAttach)
  const shipment = trace.nodes.find((n) => n.type === 'shipment')
  const date = (shipment?.attributes.date as string | undefined) ?? null
  const used = date && claim.received ? monthsBetween(date, claim.received) : null
  const sub = ['Bơm nước MH-20', claim.customer_name && date ? `giao ${claim.customer_name} ngày ${date}` : null, used ? `đã dùng ${used} tháng` : null]
    .filter(Boolean).join(' · ')
  const lot = trace.edges.find((e) => e.from_id === serial && e.relation === 'uses_lot')?.to_id
  const fault = mode === 'fault'
  const showImpact = () => {
    if (!lot) return
    useDemo.getState().selectNode(lot)
    useDemo.getState().setEvidence('impact')
  }
  return (
    <div className="entity">
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className="mono" style={{ fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap' }}>{serial}</span>
          <span className="chip red claimchip" title={claim.symptom ?? undefined}><span className="ellipsis">{`${claim.id} · ${claim.symptom ?? 'claim'}`}</span></span>
        </div>
        <span className="mut ellipsis">{sub}</span>
      </div>
      <span className="chip thr asof" title={`Thời điểm ${serial} được ép — mọi liên kết có hiệu lực tại mốc này`}>
        <span className="mut">Tại</span><span className="mono">{asOf}</span>
      </span>
      {fault && faultOrigin && (
        <span className="chip red" style={{ flex: 'none' }}>
          <span>{`Điểm lỗi: ${faultOrigin}`}</span>
          <button className="xbtn" aria-label="Về điểm lỗi của claim" title="Về điểm lỗi của claim" onClick={() => setFaultOrigin(null)}>✕</button>
        </span>
      )}
      <span className="vsep" />
      <button
        className={fault ? 'btn pri' : 'btn'} aria-pressed={fault} onClick={() => setMode(fault ? 'normal' : 'fault')}
        title="Tô đỏ điểm lỗi và thượng nguồn, cam phần hạ nguồn có thể bị ảnh hưởng"
      >
        Truy lỗi
      </button>
      {lot && <button className="btn" onClick={showImpact} title={`Phạm vi ảnh hưởng của ${lot}`}>Khoanh vùng</button>}
      <button className="btn" onClick={openAttach}>Gắn tài liệu</button>
    </div>
  )
}
