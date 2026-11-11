import { getImpact } from '../api/client'
import type { TraceGraph } from '../api/types'
import { formatPlantTime } from '../lib/time'
import { Pending, useAsync } from './useAsync'
import { useTrace } from './useTrace'

const fmt = (n: number) => n.toLocaleString('en-US')
const Tile = ({ label, value, bg, ink }: { label: string; value: string; bg: string; ink?: string }) => (
  <div style={{ background: bg, padding: '8px 10px' }}>
    <div className={ink ? undefined : 'mut'} style={{ fontSize: 11, color: ink }}>{label}</div>
    <div className="mono" style={{ fontSize: 20, fontWeight: 500, color: ink }}>{value}</div>
  </div>
)

export function ImpactTab({ trace: given, lot = 'LOT-B' }: { trace?: TraceGraph; lot?: string }) {
  const trace = useTrace(given)
  const s = useAsync(() => getImpact(lot), [lot])
  if (s.status !== 'ok') return <Pending state={s} />
  if (!trace) return <Pending state={{ status: 'loading' }} />
  const imp = s.data
  const held = imp.shipments.filter((x) => x.status !== 'delivered')
  const claimByCustomer = new Map(
    trace.nodes.filter((n) => n.type === 'claim' && n.attributes.customer).map((n) => [String(n.attributes.customer), n.id]),
  )
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontWeight: 600 }}>Truy xuôi {imp.lot}</span>
        <span className="mut">lô → processed_on → packed_in → shipped_in · knowledge graph</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        <Tile label={`Part dùng ${imp.lot}`} value={fmt(imp.parts)} bg="var(--panel)" />
        <Tile label="Thùng" value={fmt(imp.boxes)} bg="var(--panel)" />
        <Tile label="Đã tới khách hàng" value={`${imp.delivered_shipments} lô · ${fmt(imp.delivered_parts)}`} bg="var(--red-bg)" ink="var(--red-ink)" />
        <Tile label="Trong kho · cần cách ly" value={`${held.length} lô · ${fmt(imp.held_parts)}`} bg="var(--amber-bg)" ink="var(--amber-ink)" />
      </div>
      <table className="g">
        <thead><tr><th>Lô xuất hàng</th><th>Khách hàng</th><th>Số part</th><th>Thùng</th><th>Trạng thái</th><th>Nguồn</th></tr></thead>
        <tbody>
          {imp.shipments.map((x) => {
            const delivered = x.status === 'delivered'
            const claim = x.customer_id ? claimByCustomer.get(x.customer_id) : undefined
            return (
              <tr key={x.id} style={{ background: delivered ? 'var(--red-bg)' : 'var(--amber-bg)' }}>
                <td className="mono">{x.id}</td>
                <td>{x.customer_name ? `${x.customer_name} · ${claim ? `có ${claim}` : 'chưa có claim'}` : 'chưa xuất'}</td>
                <td className="mono">{fmt(x.parts)}</td>
                <td className="mono">{fmt(x.boxes)}</td>
                <td style={{ color: delivered ? 'var(--red-ink)' : 'var(--amber-ink)' }}>
                  {delivered ? `đã giao ${x.date ? formatPlantTime(`${x.date}T00:00:00+07:00`).slice(0, 5) : ''}` : 'trong kho FG'}
                </td>
                <td><span className="cite">{delivered ? 'ERP SHP' : 'WMS FG'}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
