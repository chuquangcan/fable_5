import { useState } from 'react'
import { getEvents } from '../api/client'
import { eventTypeLabel, formatPayload } from '../lib/labels'
import { formatPlantTime } from '../lib/time'
import { useDemo } from '../store/demo'
import { Pending, useAsync } from './useAsync'

const LIMIT = 500

/** Every event recorded on a node, newest last, filterable by type; payload keys shown with Vietnamese labels. */
export function EventsTab({ id }: { id: string }) {
  const dataVersion = useDemo((s) => s.dataVersion)
  const [type, setType] = useState<string | null>(null)
  const all = useAsync(() => getEvents(id, undefined, undefined, undefined, 10000), [id, dataVersion])
  if (all.status !== 'ok') return <Pending state={all} />
  const counts = new Map<string, number>()
  for (const e of all.data) counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
  const rows = all.data.filter((e) => !type || e.type === type)
  const shown = rows.slice(0, LIMIT)
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div role="group" aria-label="Lọc sự kiện theo loại" style={{ display: 'flex', gap: 4, padding: '8px 14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className={`chip fchip${type === null ? ' on' : ''}`} aria-pressed={type === null} onClick={() => setType(null)}>{`Tất cả ${all.data.length}`}</button>
        {[...counts].map(([t, n]) => (
          <button key={t} className={`chip fchip${type === t ? ' on' : ''}`} aria-pressed={type === t} onClick={() => setType(t)}>{`${eventTypeLabel(t)} ${n}`}</button>
        ))}
        {rows.length > LIMIT && <span className="mut" style={{ marginLeft: 'auto', fontSize: 11 }}>{`Hiển thị ${LIMIT} / ${rows.length.toLocaleString('en-US')}`}</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {shown.length === 0 ? <div className="mut" style={{ padding: '4px 14px' }}>Chưa có sự kiện</div> : (
          <table className="g sticky">
            <thead><tr><th>Thời điểm</th><th>Loại</th><th>Nội dung</th><th>Nguồn</th></tr></thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.event_id}>
                  <td className="mono">{formatPlantTime(e.event_time, 'YYYY-MM-DD HH:mm:ss')}</td>
                  <td>{eventTypeLabel(e.type)}</td>
                  <td style={{ whiteSpace: 'normal' }}>{formatPayload(e.payload)}</td>
                  <td><span className="cite" title={e.source_record_id ?? undefined}>{e.source}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
