import { useEffect, useRef } from 'react'
import { documentFileUrl, getDocument } from '../api/client'
import type { DocDetail, ReviewItem } from '../api/types'
import { Pending, useAsync } from '../evidence/useAsync'
import { docTypeLabel, methodLabel, objectTypeLabel, relationLabel, statusLabel } from '../lib/labels'
import { formatPlantTime } from '../lib/time'
import { ReviewActions } from '../review/ReviewActions'
import { useFocusTrap } from '../lib/useFocusTrap'
import { useDemo } from '../store/demo'

function Meta({ d }: { d: DocDetail }) {
  const rows: [string, string][] = [
    ['Type', docTypeLabel(d.type)],
    ['Source', d.uploaded ? 'Uploaded in the demo' : d.source ?? '—'],
    ['Trang', d.pages.length ? d.pages.join(', ') : '—'],
    ['Effective from', d.effective_from ? formatPlantTime(d.effective_from, 'YYYY-MM-DD HH:mm') : '—'],
    ['Extracted codes', d.codes.length ? d.codes.join(', ') : '—'],
  ]
  return (
    <table className="g kv">
      <tbody>
        {rows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td className={k === 'Extracted codes' ? 'mono' : undefined}>{v}</td></tr>)}
        <tr>
          <th scope="row">Original file</th>
          <td>
            {d.has_file ? (
              <a className="btn" href={documentFileUrl(d.doc_id)} target="_blank" rel="noopener noreferrer">Open original ↗</a>
            ) : (
              <span className="mut" style={{ whiteSpace: 'normal' }}>
                {d.file_uri ? <span className="mono">{d.file_uri}</span> : null} · the original lives in the {d.source ?? 'source'} system and is not included in the sample data
              </span>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function LinkRow({ l, docId }: { l: ReviewItem; docId: string }) {
  const goTo = useDemo((s) => s.goTo)
  const closeDoc = useDemo((s) => s.closeDoc)
  const out = l.from_id === docId
  const other = out ? { id: l.to_id, name: l.to_name, type: l.to_type } : { id: l.from_id, name: l.from_name, type: l.from_type }
  return (
    <div className={`it doc-${l.status}`} style={{ margin: 0, gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="mut">{relationLabel(l.relation)}</span>
        <button className="cite" style={{ cursor: 'pointer' }} onClick={() => { closeDoc(); goTo(other.id) }} title="Open object">
          {other.id}
        </button>
        <span className="mut" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {objectTypeLabel(other.type)}{other.name !== other.id ? ` · ${other.name}` : ''}
        </span>
        <span style={{ flex: 1 }} />
        <span className={`chip st-${l.status}`}>{`${statusLabel(l.status)} · tier ${l.tier}${l.score != null ? ` · ${l.score.toFixed(2)}` : ''}`}</span>
      </div>
      {(l.method || l.reason) && (
        <div className="mut">{[l.method && methodLabel(l.method), l.reason].filter(Boolean).join(' — ')}</div>
      )}
      <ReviewActions linkId={l.link_id} status={l.status} label={`${l.from_id} → ${l.to_id}`} withNote />
    </div>
  )
}

function Body({ id }: { id: string }) {
  const dataVersion = useDemo((s) => s.dataVersion)
  const s = useAsync(() => getDocument(id), [id, dataVersion])
  if (s.status !== 'ok') return <Pending state={s} />
  const d = s.data
  const toReview = d.review_links.filter((l) => l.status !== 'confirmed').length
  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <section className="dsec">
        <Meta d={d} />
      </section>
      <section className="dsec">
        <h3 className="sec">Links to nodes <span className="mut">{toReview ? `${toReview} to review` : `${d.review_links.length}`}</span></h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 12px' }}>
          {d.review_links.length === 0
            ? <span className="mut">Document is not attached to any node (its link was rejected or it is not yet classified).</span>
            : d.review_links.map((l) => <LinkRow key={l.link_id} l={l} docId={d.doc_id} />)}
        </div>
      </section>
      <section className="dsec">
        <h3 className="sec">Content</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 12px' }}>
          {d.chunks.map((c) => (
            <div key={c.chunk_id}>
              <div className="mut mono" style={{ fontSize: 11 }}>{c.page ? `Trang ${c.page}` : c.chunk_id}</div>
              <p style={{ margin: '2px 0 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.text}</p>
            </div>
          ))}
        </div>
      </section>
      {d.history.length > 0 && (
        <section className="dsec">
          <h3 className="sec">Review history</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px' }}>
            {d.history.map((h) => (
              <div key={h.review_id}>
                <span style={{ color: h.decision === 'approve' ? 'var(--teal-ink)' : 'var(--red-ink)', fontWeight: 600 }}>
                  {h.decision === 'approve' ? 'Approved' : 'Rejected'}
                </span>{' '}
                <span className="mono">{h.from_id} → {h.to_id}</span>
                <span className="mut">{` · from ${statusLabel(h.from_status)} · ${h.reviewer} · ${formatPlantTime(h.reviewed_at, 'YYYY-MM-DD HH:mm')}`}</span>
                {h.note && <div className="mut">“{h.note}”</div>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/** Right-hand drawer with one document: metadata, original file, links (with review) and full text. */
export function DocDrawer() {
  const id = useDemo((s) => s.docId)
  const closeDoc = useDemo((s) => s.closeDoc)
  const ref = useRef<HTMLDivElement>(null)
  // inactive while the attach dialog is on top, so the two traps do not fight
  const attachOpen = useDemo((s) => s.attachOpen)
  useFocusTrap(ref, !!id && !attachOpen)
  useEffect(() => {
    if (!id) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !useDemo.getState().attachOpen) closeDoc() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [id, closeDoc])
  if (!id) return null
  return (
    <>
      <div className="scrim" onMouseDown={closeDoc} />
      <aside ref={ref} role="dialog" aria-modal="true" aria-labelledby="doc-title" tabIndex={-1} className="drawer">
        <div style={{ height: 40, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderBottom: '1px solid var(--line-soft)' }}>
          <span id="doc-title" className="mono" style={{ fontWeight: 600, fontSize: 14 }}>{id}</span>
          <span className="mut">Document details</span>
          <span style={{ flex: 1 }} />
          <button className="btn" aria-label="Close" onClick={closeDoc}>✕</button>
        </div>
        <Body id={id} />
      </aside>
    </>
  )
}
