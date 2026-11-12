import { getClaims, getImpact } from '../api/client'
import { formatPlantTime } from '../lib/time'
import { Pending, useAsync } from './useAsync'

const fmt = (n: number) => n.toLocaleString('en-US')
const Tile = ({ label, value, bg, ink }: { label: string; value: string; bg: string; ink?: string }) => (
  <div style={{ background: bg, padding: '8px 10px' }}>
    <div className={ink ? undefined : 'mut'} style={{ fontSize: 11, color: ink }}>{label}</div>
    <div className="mono" style={{ fontSize: 20, fontWeight: 500, color: ink }}>{value}</div>
  </div>
)

/** Forward trace of a lot: parts, boxes, shipments, and which customers already have a claim. */
export function ImpactTab({ lot }: { lot: string }) {
  const s = useAsync(() => Promise.all([getImpact(lot), getClaims()]), [lot])
  if (s.status !== 'ok') return <Pending state={s} />
  const [imp, claims] = s.data
  const held = imp.shipments.filter((x) => x.status !== 'delivered')
  const claimByCustomer = new Map(claims.filter((c) => c.customer_id).map((c) => [c.customer_id!, c.id]))
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontWeight: 600 }}>Forward trace {imp.lot}</span>
        <span className="mut">lot → processed_on → packed_in → shipped_in · knowledge graph</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        <Tile label={`Parts using ${imp.lot}`} value={fmt(imp.parts)} bg="var(--panel)" />
        <Tile label="Boxes" value={fmt(imp.boxes)} bg="var(--panel)" />
        <Tile label="Delivered to customers" value={`${imp.delivered_shipments} shipments · ${fmt(imp.delivered_parts)}`} bg="var(--red-bg)" ink="var(--red-ink)" />
        <Tile label="In warehouse · to quarantine" value={`${held.length} shipments · ${fmt(imp.held_parts)}`} bg="var(--amber-bg)" ink="var(--amber-ink)" />
      </div>
      <table className="g">
        <thead><tr><th>Shipment</th><th>Customer</th><th>Parts</th><th>Boxes</th><th>Status</th><th>Source</th></tr></thead>
        <tbody>
          {imp.shipments.map((x) => {
            const delivered = x.status === 'delivered'
            const claim = x.customer_id ? claimByCustomer.get(x.customer_id) : undefined
            return (
              <tr key={x.id} style={{ background: delivered ? 'var(--red-bg)' : 'var(--amber-bg)' }}>
                <td className="mono">{x.id}</td>
                <td>{x.customer_name ? `${x.customer_name} · ${claim ? `has ${claim}` : 'no claim yet'}` : 'not shipped'}</td>
                <td className="mono">{fmt(x.parts)}</td>
                <td className="mono">{fmt(x.boxes)}</td>
                <td style={{ color: delivered ? 'var(--red-ink)' : 'var(--amber-ink)' }}>
                  {delivered ? `delivered ${x.date ? formatPlantTime(`${x.date}T00:00:00+07:00`).slice(0, 5) : ''}` : 'in FG warehouse'}
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
