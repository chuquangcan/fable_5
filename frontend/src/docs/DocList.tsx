import { useState } from 'react'
import type { DocView, EdgeStatus } from '../api/types'
import { DocBadge, docTitle } from '../evidence/DocBadge'
import { docTypeLabel, statusLabel } from '../lib/labels'
import { useDemo } from '../store/demo'
import { sortDocs } from './sortDocs'

const FILTERS: (EdgeStatus | 'all')[] = ['all', 'confirmed', 'inferred', 'pending', 'suggested']
/** Documents linked to a node: filter by status, click a card for the detail drawer. */
export function DocList({ docs }: { docs: DocView[] }) {
  const openDoc = useDemo((s) => s.openDoc)
  const [filter, setFilter] = useState<EdgeStatus | 'all'>('all')
  const present = FILTERS.filter((f) => f === 'all' || docs.some((d) => d.status === f))
  const shown = sortDocs(docs.filter((d) => filter === 'all' || d.status === filter))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
      {present.length > 2 && (
        <div role="group" aria-label="Lọc tài liệu theo trạng thái" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '0 10px' }}>
          {present.map((f) => (
            <button key={f} className={`chip fchip${filter === f ? ' on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? `Tất cả ${docs.length}` : `${statusLabel(f)} ${docs.filter((d) => d.status === f).length}`}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 10px 10px' }}>
        {shown.map((d, i) => (
          <button
            key={`${d.doc_id}-${d.page}-${i}`} className={`it doc doc-${d.status}`} onClick={() => openDoc(d.doc_id)}
            title="Xem chi tiết tài liệu"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="mono" style={{ fontWeight: 500 }}>{docTitle(d)}</span>
              <span className="mut" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{docTypeLabel(d.type)}</span>
              <span style={{ flex: 1 }} />
              {d.doc_id.startsWith('D-U') && <span className="chip thr">mới</span>}
              <DocBadge d={d} />
            </div>
            <span className="mut clamp2">{d.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
