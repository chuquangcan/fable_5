import { getReviewQueue } from '../api/client'
import type { ReviewItem } from '../api/types'
import { Pending, useAsync } from '../evidence/useAsync'
import { docTypeLabel, methodLabel, objectTypeLabel, relationLabel, statusLabel } from '../lib/labels'
import { formatPlantTime } from '../lib/time'
import { useDemo } from '../store/demo'
import { ReviewActions } from './ReviewActions'

const docName = (i: ReviewItem) => {
  const doc = i.from_id === i.doc_id ? i.from_name : i.to_name
  return docTypeLabel(doc.replace(/ p\.\d+$/, ''))
}

function Item({ i, actions }: { i: ReviewItem; actions: boolean }) {
  const openDoc = useDemo((s) => s.openDoc)
  const goTo = useDemo((s) => s.goTo)
  const label = `${i.from_id} → ${i.to_id}`
  const setDataTab = useDemo((s) => s.setDataTab)
  // compact (sidebar): a doc opens its drawer to review there; a non-doc link opens the full queue
  const open = () => (i.doc_id ? openDoc(i.doc_id) : actions ? goTo(i.from_id) : setDataTab('review'))
  return (
    <div className={`it doc-${i.status}`} style={{ gap: 5 }}>
      <button className="linkish" onClick={open} title={i.doc_id ? 'Xem chi tiết và duyệt' : actions ? 'Mở đối tượng' : 'Duyệt trong hàng đợi'}>
        <span className="mono" style={{ fontWeight: 500 }}>{label}</span>
        <span className={`chip st-${i.status}`} style={{ marginLeft: 'auto' }}>
          {`${statusLabel(i.status)}${i.score != null ? ` · ${i.score.toFixed(2)}` : ''}`}
        </span>
      </button>
      <div className="mut">
        {i.doc_id ? docName(i) : objectTypeLabel(i.from_type)} {relationLabel(i.relation)} {objectTypeLabel(i.to_id === i.doc_id ? i.from_type : i.to_type).toLowerCase()}
        {i.method ? ` · ${methodLabel(i.method)}` : ''}{` · bậc ${i.tier}`}
      </div>
      {actions && <ReviewActions linkId={i.link_id} status={i.status} label={label} />}
    </div>
  )
}

/** Links nobody has checked yet (inferred / pending / suggested), across the whole dataset. */
export function ReviewQueueList({ compact = false }: { compact?: boolean }) {
  const dataVersion = useDemo((s) => s.dataVersion)
  const s = useAsync(getReviewQueue, [dataVersion])
  if (s.status !== 'ok') return compact ? null : <Pending state={s} />
  const { pending, decided } = s.data
  return (
    <section aria-label="Hàng đợi duyệt">
      <div className="sec"><span>Hàng đợi duyệt</span><span className="mut">{pending.length}</span></div>
      {pending.length === 0 && <div className="mut" style={{ padding: '0 10px' }}>Không còn liên kết chờ duyệt</div>}
      {pending.map((i) => <Item key={i.link_id} i={i} actions={!compact} />)}
      {!compact && decided.length > 0 && (
        <>
          <div className="sec"><span>Đã quyết định</span><span className="mut">{decided.length}</span></div>
          {decided.map((d) => (
            <div key={d.review_id} className="it">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: d.decision === 'approve' ? 'var(--teal-ink)' : 'var(--red-ink)' }}>
                  {d.decision === 'approve' ? 'Duyệt' : 'Từ chối'}
                </span>
                <span className="mono">{d.from_id} → {d.to_id}</span>
                <span className="mut" style={{ marginLeft: 'auto' }}>{formatPlantTime(d.reviewed_at, 'YYYY-MM-DD HH:mm')}</span>
              </div>
              <div className="mut">{`${relationLabel(d.relation)} · trước đó ${statusLabel(d.from_status).toLowerCase()} · ${d.reviewer}`}{d.note ? ` · “${d.note}”` : ''}</div>
            </div>
          ))}
        </>
      )}
    </section>
  )
}
