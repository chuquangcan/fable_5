import { getSummary } from '../api/client'
import type { FlowStage, NodeSummary, Param } from '../api/types'
import { useDemo } from '../store/demo'
import { STAGES } from '../thread/flowLayout'
import { DocBadge, docTitle } from './DocBadge'
import { Pending, useAsync } from './useAsync'

/** Summary types that /api/fault-trace cannot take as an origin (not objects in the flow). */
const NOT_FAULT_ORIGIN = new Set(['aggregate', 'event', 'source'])

const fmt = (p: Param) => (p.unit ? `${p.value} ${p.unit}` : String(p.value))

function Params({ params }: { params: Param[] }) {
  if (params.length === 0) return <div className="mut" style={{ padding: '8px 14px' }}>Chưa có thông số</div>
  return (
    <table className="g">
      <thead><tr><th>Thông số</th><th>Giá trị</th><th>Nguồn</th></tr></thead>
      <tbody>
        {params.map((p, i) => (
          <tr key={`${p.label}-${i}`}>
            <td>{p.label}</td>
            <td className="mono">{fmt(p)}</td>
            <td><span className="cite" title={p.source_record_id ?? undefined}>{p.source}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Docs({ docs }: { docs: NodeSummary['docs'] }) {
  const openAttach = useDemo((s) => s.openAttach)
  if (docs.length === 0)
    return (
      <div className="mut" style={{ padding: '8px 10px' }}>
        Chưa có tài liệu · <button className="btn" onClick={openAttach}>Gắn tài liệu</button>
      </div>
    )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 10px' }}>
      {docs.map((d, i) => (
        <div key={`${d.doc_id}-${d.page}-${i}`} className="it" style={{
          margin: 0,
          ...(d.status === 'pending' ? { borderColor: 'var(--teal)' } : {}),
          ...(d.status === 'suggested' ? { borderStyle: 'dotted', background: '#F7F8F9' } : {}),
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="mono">{docTitle(d)}</span><span style={{ display: 'flex', gap: 4 }}>
              {d.doc_id.startsWith('D-U') && <span className="chip" style={{ borderColor: 'var(--teal)', color: 'var(--teal-ink)' }}>mới</span>}
              <DocBadge d={d} />
            </span>
          </div>
          <span className="mut" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{d.text}</span>
        </div>
      ))}
    </div>
  )
}

export function OverviewTab({ id }: { id: string }) {
  const dataVersion = useDemo((s) => s.dataVersion)
  const setFaultOrigin = useDemo((s) => s.setFaultOrigin)
  const openAttach = useDemo((s) => s.openAttach)
  const s = useAsync(() => getSummary(id), [id, dataVersion])
  // Not every citable id has a summary: a 404 is "nothing to show", not a failure.
  if (s.status === 'error' && s.message.startsWith('404')) return <div className="mut" style={{ padding: 14 }}>{`Không có tổng hợp cho ${id}`}</div>
  if (s.status !== 'ok') return <Pending state={s} />
  const d = s.data
  return (
    <div style={{ height: 376, display: 'flex' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line-faint)', overflowY: 'auto' }}>
        <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>{`${d.name} · ${d.type}`}</span>
          <span className="mut">{STAGES[d.stage as FlowStage] ?? d.stage}</span>
          <span style={{ flex: 1 }} />
          {!NOT_FAULT_ORIGIN.has(d.type) && <button className="btn" onClick={() => setFaultOrigin(id)}>Đặt làm điểm lỗi</button>}
          <button className="btn" onClick={openAttach}>Gắn tài liệu</button>
        </div>
        <Params params={d.params} />
      </div>
      <div style={{ width: 330, flex: 'none', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '10px 14px 6px', fontWeight: 600 }}>Tài liệu</div>
        <Docs docs={d.docs} />
      </div>
    </div>
  )
}
