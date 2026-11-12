import { useEffect, useState } from 'react'
import { getTable, getTables, listDocuments } from '../api/client'
import type { DocStatus } from '../api/types'
import { Pending, useAsync } from '../evidence/useAsync'
import { docTypeLabel, statusLabel } from '../lib/labels'
import { formatPlantTime } from '../lib/time'
import { useDemo } from '../store/demo'

const STATUSES: DocStatus[] = ['confirmed', 'inferred', 'pending', 'suggested', 'unlinked']
const PAGE = 50

/** Main tab of the document store (`docs`) or of one raw table. */
const openData = (target: string, title: string) =>
  useDemo.getState().openTab('main', { id: `table:${target}`, kind: 'table', target, title })

/** Left rail of the data repository: the document store, the review queue and the raw tables, each opening a tab. */
export function DataSidebar() {
  const dataVersion = useDemo((s) => s.dataVersion)
  const mainActive = useDemo((s) => s.groups.main.active)
  const reviewActive = useDemo((s) => s.groups.bottom.active === 'review')
  const openReview = useDemo((s) => s.openReview)
  const tables = useAsync(getTables, [dataVersion])
  const item = (key: string, on: boolean, open: () => void, label: string, extra?: string, mono = false) => (
    <button key={key} className={`asset${on ? ' on' : ''}`} aria-current={on || undefined} onClick={open}>
      <span className={mono ? 'mono' : undefined}>{label}</span><span style={{ flex: 1 }} />{extra && <span className="mut mono">{extra}</span>}
    </button>
  )
  return (
    <>
      <div className="side-title">Data repository</div>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        <div className="sec"><span>Documents</span></div>
        {item('docs', mainActive === 'table:docs', () => openData('docs', 'Document repository'), 'Document repository')}
        {item('review', reviewActive, openReview, 'Review queue')}
        <div className="sec"><span>Data tables · read-only</span></div>
        {tables.status === 'ok' && tables.data.map((t) =>
          item(t.name, mainActive === `table:${t.name}`, () => openData(t.name, t.name), t.name, t.rows.toLocaleString('en-US'), true))}
      </div>
    </>
  )
}

function Documents() {
  const dataVersion = useDemo((s) => s.dataVersion)
  const openDoc = useDemo((s) => s.openDoc)
  const goTo = useDemo((s) => s.goTo)
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const all = useAsync(() => listDocuments(), [dataVersion])
  if (all.status !== 'ok') return <Pending state={all} />
  const types = [...new Set(all.data.map((d) => d.type))].sort()
  const needle = q.trim().toLowerCase()
  const rows = all.data.filter((d) =>
    (!type || d.type === type)
    && (!status || (status === 'unlinked' ? d.links.length === 0 : d.links.some((l) => l.status === status)))
    && (!needle || [d.doc_id, d.type, docTypeLabel(d.type), d.source ?? '', d.excerpt, ...d.codes, ...d.links.map((l) => l.other_id)]
      .join(' ').toLowerCase().includes(needle)))
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="filters">
        <input className="inp" aria-label="Search documents" placeholder="Search code, content, node…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
        <select className="inp" aria-label="Document type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {types.map((t) => <option key={t} value={t}>{docTypeLabel(t)}</option>)}
        </select>
        <select className="inp" aria-label="Link status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <span className="mut" style={{ marginLeft: 'auto' }}>{`${rows.length} / ${all.data.length} documents`}</span>
        <button className="btn" onClick={() => useDemo.getState().openAttach()}>Attach document</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <table className="g sticky hover">
          <thead><tr><th>ID</th><th>Type</th><th>Source</th><th>Attached to</th><th>Status</th><th>Effective from</th><th>Content</th><th>Original file</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.doc_id} onClick={() => openDoc(d.doc_id)} style={{ cursor: 'pointer' }}>
                <td className="mono"><button className="linkish mono" onClick={(e) => { e.stopPropagation(); openDoc(d.doc_id) }}>{d.doc_id}</button>{d.uploaded && <span className="chip thr" style={{ marginLeft: 4 }}>new</span>}</td>
                <td>{docTypeLabel(d.type)}</td>
                <td>{d.uploaded ? 'Uploaded' : d.source}</td>
                <td>
                  <span style={{ display: 'inline-flex', gap: 3, flexWrap: 'wrap' }}>
                    {d.links.length === 0 ? <span className="mut">—</span> : d.links.map((l) => (
                      <button key={l.link_id} className="cite" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); goTo(l.other_id) }}>{l.other_id}</button>
                    ))}
                  </span>
                </td>
                <td><span className={`chip st-${d.status}`}>{statusLabel(d.status)}</span></td>
                <td className="mono">{d.effective_from ? formatPlantTime(d.effective_from, 'YYYY-MM-DD HH:mm').slice(0, 10) : '—'}</td>
                <td style={{ whiteSpace: 'normal', minWidth: 240 }}><span className="mut clamp2">{d.excerpt}</span></td>
                <td>{d.has_file ? 'yes' : <span className="mut">at {d.uploaded ? '—' : d.source}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return '∅'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function Table({ name }: { name: string }) {
  const dataVersion = useDemo((s) => s.dataVersion)
  const [q, setQ] = useState('')
  const [applied, setApplied] = useState('')
  const [offset, setOffset] = useState(0)
  useEffect(() => { setQ(''); setApplied(''); setOffset(0) }, [name])
  const s = useAsync(() => getTable(name, applied, PAGE, offset), [name, applied, offset, dataVersion])
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <form className="filters" onSubmit={(e) => { e.preventDefault(); setOffset(0); setApplied(q.trim()) }}>
        <span className="mono" style={{ fontWeight: 600 }}>{name}</span>
        <input className="inp" aria-label={`Filter table ${name}`} placeholder="Filter by row content…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
        <button className="btn" type="submit">Filter</button>
        {s.status === 'ok' && (
          <>
            <span className="mut" style={{ marginLeft: 'auto' }}>
              {s.data.total === 0 ? '0 rows' : `${(offset + 1).toLocaleString('en-US')}–${Math.min(offset + PAGE, s.data.total).toLocaleString('en-US')} / ${s.data.total.toLocaleString('en-US')}`}
            </span>
            <button type="button" className="btn" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} aria-label="Previous page">‹</button>
            <button type="button" className="btn" disabled={offset + PAGE >= s.data.total} onClick={() => setOffset(offset + PAGE)} aria-label="Trang sau">›</button>
          </>
        )}
      </form>
      {s.status !== 'ok' ? <Pending state={s} /> : (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <table className="g sticky">
            <thead><tr>{s.data.columns.map((c) => <th key={c} className="mono">{c}</th>)}</tr></thead>
            <tbody>
              {s.data.rows.map((r, i) => (
                <tr key={i}>
                  {s.data.columns.map((c) => {
                    const v = cell(r[c])
                    return <td key={c} className="mono cellv" title={v.length > 60 ? v : undefined}>{v}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** A data tab: `docs` is the document store, any other target is a raw table. */
export function DataView({ target }: { target: string }) {
  const docs = target === 'docs'
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="viewbar">
        <span style={{ fontWeight: 600 }}>{docs ? 'Document repository' : 'Data tables'}</span>
        <span className="mut">{docs ? '· every document and the nodes it is attached to' : '· raw data in PostgreSQL, read-only'}</span>
      </div>
      {docs ? <Documents /> : <Table name={target} />}
    </div>
  )
}
