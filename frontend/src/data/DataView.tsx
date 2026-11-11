import { useEffect, useState } from 'react'
import { getTable, getTables, listDocuments } from '../api/client'
import type { DocStatus } from '../api/types'
import { Pending, useAsync } from '../evidence/useAsync'
import { docTypeLabel, statusLabel } from '../lib/labels'
import { formatPlantTime } from '../lib/time'
import { ReviewQueueList } from '../review/ReviewQueueList'
import { type DataTab, useDemo } from '../store/demo'

const STATUSES: DocStatus[] = ['confirmed', 'inferred', 'pending', 'suggested', 'unlinked']
const PAGE = 50

/** Left rail of the data view: the document store, the review queue and the raw tables with row counts. */
export function DataSidebar() {
  const dataVersion = useDemo((s) => s.dataVersion)
  const tab = useDemo((s) => s.dataTab)
  const table = useDemo((s) => s.dataTable)
  const setDataTab = useDemo((s) => s.setDataTab)
  const tables = useAsync(getTables, [dataVersion])
  const item = (t: DataTab, label: string, extra?: string, name?: string) => {
    const on = tab === t && (t !== 'tables' || name === table)
    return (
      <button key={name ?? t} className={`asset${on ? ' on' : ''}`} aria-current={on || undefined} onClick={() => setDataTab(t, name)}>
        <span className={name ? 'mono' : undefined}>{label}</span><span style={{ flex: 1 }} />{extra && <span className="mut mono">{extra}</span>}
      </button>
    )
  }
  return (
    <>
      <div className="side-title">Kho dữ liệu</div>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        <div className="sec"><span>Tài liệu</span></div>
        {item('docs', 'Kho tài liệu')}
        {item('review', 'Hàng đợi duyệt')}
        <div className="sec"><span>Bảng dữ liệu · chỉ đọc</span></div>
        {tables.status === 'ok' && tables.data.map((t) => item('tables', t.name, t.rows.toLocaleString('en-US'), t.name))}
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
        <input className="inp" aria-label="Tìm tài liệu" placeholder="Tìm mã, nội dung, node…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
        <select className="inp" aria-label="Loại tài liệu" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Mọi loại</option>
          {types.map((t) => <option key={t} value={t}>{docTypeLabel(t)}</option>)}
        </select>
        <select className="inp" aria-label="Trạng thái liên kết" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Mọi trạng thái</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <span className="mut" style={{ marginLeft: 'auto' }}>{`${rows.length} / ${all.data.length} tài liệu`}</span>
        <button className="btn" onClick={() => useDemo.getState().openAttach()}>Gắn tài liệu</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <table className="g sticky hover">
          <thead><tr><th>Mã</th><th>Loại</th><th>Nguồn</th><th>Gắn vào</th><th>Trạng thái</th><th>Hiệu lực từ</th><th>Nội dung</th><th>Bản gốc</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.doc_id} onClick={() => openDoc(d.doc_id)} style={{ cursor: 'pointer' }}>
                <td className="mono"><button className="linkish mono" onClick={(e) => { e.stopPropagation(); openDoc(d.doc_id) }}>{d.doc_id}</button>{d.uploaded && <span className="chip thr" style={{ marginLeft: 4 }}>mới</span>}</td>
                <td>{docTypeLabel(d.type)}</td>
                <td>{d.uploaded ? 'Tải lên' : d.source}</td>
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
                <td>{d.has_file ? 'có' : <span className="mut">ở {d.uploaded ? '—' : d.source}</span>}</td>
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
        <input className="inp" aria-label={`Lọc bảng ${name}`} placeholder="Lọc theo nội dung dòng…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
        <button className="btn" type="submit">Lọc</button>
        {s.status === 'ok' && (
          <>
            <span className="mut" style={{ marginLeft: 'auto' }}>
              {s.data.total === 0 ? '0 dòng' : `${(offset + 1).toLocaleString('en-US')}–${Math.min(offset + PAGE, s.data.total).toLocaleString('en-US')} / ${s.data.total.toLocaleString('en-US')}`}
            </span>
            <button type="button" className="btn" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} aria-label="Trang trước">‹</button>
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

const TITLE: Record<DataTab, string> = { docs: 'Kho tài liệu', review: 'Hàng đợi duyệt', tables: 'Bảng dữ liệu' }

export function DataView() {
  const tab = useDemo((s) => s.dataTab)
  const table = useDemo((s) => s.dataTable)
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="viewbar">
        <span style={{ fontWeight: 600 }}>{TITLE[tab]}</span>
        <span className="mut">
          {tab === 'docs' ? '· mọi tài liệu và node chúng được gắn vào' : tab === 'review' ? '· liên kết máy tạo, chờ người duyệt' : '· dữ liệu thô trong PostgreSQL, chỉ đọc'}
        </span>
      </div>
      {tab === 'docs' && <Documents />}
      {tab === 'review' && <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px', maxWidth: 720 }}><ReviewQueueList /></div>}
      {tab === 'tables' && <Table name={table} />}
    </div>
  )
}
