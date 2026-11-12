import { Pending } from '../evidence/useAsync'
import { deptLabel } from '../lib/labels'
import { formatPlantTime } from '../lib/time'
import { count, usePlantOverview } from './usePlantOverview'

/** Dock tab: every source system feeding the thread, with its department, volume, last record and delay. */
export function DataSources() {
  const o = usePlantOverview()
  if (o.status !== 'ok') return <Pending state={o} />
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      <table className="g sticky" aria-label="Data sources">
        <thead><tr><th>Source</th><th>Department</th><th>Events</th><th>Last record</th><th>Delay</th></tr></thead>
        <tbody>
          {o.data.sources.map((s) => (
            <tr key={s.source}>
              <td className="mono">{s.source}</td>
              <td>{s.dept ? deptLabel(s.dept) : '—'}</td>
              <td className="mono">{count(s.events)}</td>
              <td className="mono">{s.last_at ? formatPlantTime(s.last_at, 'YYYY-MM-DD HH:mm') : '—'}</td>
              <td className="mono">{s.delay_s == null ? '—' : `${Math.round(s.delay_s)} s`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
