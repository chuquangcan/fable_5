import { Pending } from '../evidence/useAsync'
import { useDemo } from '../store/demo'
import { Sparkline } from './Sparkline'
import { count, secs, usePlantOverview } from './usePlantOverview'

const STATE_TEXT: Record<string, string> = { running: 'running', stopped: 'stopped', warning: 'warning', watch4m: '4M watch', idle: 'idle' }

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div role="group" aria-label={label} className="kpi">
      <span className="mut">{label}</span>
      <span data-testid="kpi-value" className="kpi-value mono">{value}</span>
    </div>
  )
}

/** Pinned dock tab: plant KPIs, lines and machines, shipments at risk, as of the demo clock. */
export function PlantOverview() {
  const o = usePlantOverview()
  const goTo = useDemo((s) => s.goTo)
  if (o.status !== 'ok') return <Pending state={o} />
  const { kpis, rows, shipments } = o.data
  return (
    <div className="overview">
      <div className="kpis">
        <Kpi label="Output" value={count(kpis.output)} />
        <Kpi label="Cycle vs target" value={kpis.cycle_s == null ? '—' : `${secs(kpis.cycle_s)} / ${secs(kpis.target_s)}`} />
        <Kpi label="Open alerts" value={String(kpis.open_alerts)} />
        <Kpi label="4M watching" value={String(kpis.watch_4m)} />
        <Kpi label="Links pending review" value={String(kpis.pending_links)} />
      </div>
      <div className="overview-tables">
        <table className="g hover" aria-label="Lines and machines">
          <thead><tr><th>Line · machine</th><th>Status</th><th>Cycle</th><th>Target</th><th>Output</th><th>Lot</th><th>Trend</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-id={r.id} onClick={() => void goTo(r.id)} style={{ cursor: 'pointer', fontWeight: r.kind === 'line' ? 600 : undefined }}>
                <td style={{ paddingLeft: r.kind === 'machine' ? 22 : undefined }}>{r.name} <span className="mut mono">{r.id}</span></td>
                <td><span className={`st st-${r.state}`}>{STATE_TEXT[r.state] ?? r.state}</span></td>
                <td className="mono">{secs(r.cycle_s)}</td>
                <td className="mono">{secs(r.target_s)}</td>
                <td className="mono">{count(r.output)}</td>
                <td className="mono">{r.lot ?? '—'}</td>
                <td><Sparkline values={r.trend} target={r.target_s} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="g" aria-label="Shipments">
          <thead><tr><th>Shipment</th><th>Status</th><th>Customer</th><th>Parts</th><th>Risk</th><th>Reason</th></tr></thead>
          <tbody>
            {shipments.map((s) => (
              <tr key={s.id} data-id={s.id}>
                <td><button className="linkish mono" onClick={() => void goTo(s.id)}>{s.id}</button></td>
                <td>{s.status ?? '—'}{s.date ? <span className="mut"> · {s.date}</span> : null}</td>
                <td className="mono">{s.customer ?? '—'}</td>
                <td className="mono">{count(s.parts)}</td>
                <td>{s.risk === 'high' ? <span className="chip risk-high">high</span> : <span className="mut">none</span>}</td>
                <td style={{ whiteSpace: 'normal', minWidth: 200 }} className="mut">{s.reason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
