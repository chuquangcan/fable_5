import { getDocs, getEvents, getMetric } from '../api/client'
import type { DocView, TraceGraph, TraceNode } from '../api/types'
import { formatPlantTime } from '../lib/time'
import { useDemo } from '../store/demo'
import { DocList } from '../docs/DocList'
import { docTitle } from './DocBadge'
import { Pending, useAsync } from './useAsync'
import { useTrace } from './useTrace'

const AT = '2026-11-03T14:05:00+07:00'
const LOTS = ['LOT-A', 'LOT-B']

async function load() {
  const [cpk, receipts, lotDocs, similarDocs] = await Promise.all([
    getMetric('cpk', LOTS),
    Promise.all(LOTS.map((l) => getEvents(l, undefined, undefined, 'goods_receipt'))),
    getDocs('LOT-B', AT),
    getDocs('CLM-0009', AT),
  ])
  const docs = new Map<string, DocView>()
  for (const d of [...lotDocs, ...similarDocs]) if (!docs.has(d.doc_id)) docs.set(d.doc_id, d)
  return { cpk, receipts, docs: [...docs.values()].sort((a, b) => b.tier - a.tier === 0 ? b.score! - a.score! : a.tier - b.tier) }
}

const attr = (n: TraceNode | undefined, k: string) => (n?.attributes[k] ?? null) as string | number | null

export function LotTab({ trace: given }: { trace?: TraceGraph }) {
  const dataVersion = useDemo((s) => s.dataVersion)
  const trace = useTrace(given)
  const s = useAsync(load, [dataVersion])
  if (s.status !== 'ok') return <Pending state={s} />
  if (!trace) return <Pending state={{ status: 'loading' }} />
  const { cpk, receipts, docs } = s.data
  const iqc = (lot: string) => trace.nodes.find((n) => n.type === 'inspection' && n.attributes.lot === lot)
  const similar = trace.nodes.find((n) => n.type === 'claim' && n.attributes.status === 'closed')
  const similarDoc = docs.find((d) => trace.edges.some((e) => e.from_id === d.doc_id && e.to_id === similar?.id && e.relation === 'describes'))
  const specEdge = trace.edges.find((e) => e.relation === 'specified_by' && e.from_id === iqc('LOT-B')?.id)
  const specDoc = docs.find((d) => d.doc_id === specEdge?.to_id)
  const specMin = attr(iqc('LOT-B'), 'spec_min')
  const period = String(attr(similar, 'period') ?? '')
  const lc = (v: string | number | null) => (typeof v === 'string' ? v.charAt(0).toLowerCase() + v.slice(1) : '')
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line-faint)' }}>
        <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Kiểm tra đầu vào · Bearing 6203</span>
          {specMin !== null && <span className="mut">spec Cpk ≥ {specMin}{specDoc ? ` theo ${docTitle(specDoc).replace(' · ', ' ')}` : ''}</span>}
        </div>
        <table className="g">
          <thead><tr><th>Lô</th><th>Nhập kho</th><th>NCC</th><th>Cpk khe hở</th><th>Kết luận IQC</th><th>Nguồn</th></tr></thead>
          <tbody>
            {LOTS.map((lot, i) => {
              const m = cpk.find((c) => c.object_id === lot)
              const node = iqc(lot)
              const fail = m?.value != null && specMin !== null && m.value < Number(specMin)
              const r = receipts[i][0]
              return (
                <tr key={lot} style={fail ? { background: 'var(--red-bg)' } : undefined}>
                  <td className="mono" style={fail ? { fontWeight: 600, color: 'var(--amber-ink)' } : undefined}>{lot}</td>
                  <td className="mono" style={fail ? { fontWeight: 600 } : undefined}>{r ? formatPlantTime(r.event_time, 'YYYY-MM-DD HH:mm').slice(0, 10) : '—'}</td>
                  <td>S1</td>
                  <td className="mono" style={fail ? { color: 'var(--red-ink)', fontWeight: 600 } : undefined}>{m?.value?.toFixed(2) ?? '—'}</td>
                  <td style={fail ? { color: 'var(--red-ink)' } : undefined}>{attr(node, 'verdict') ?? '—'}</td>
                  <td><span className="cite">{m?.source_record_id ?? lot}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {similar && (
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.45 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: 'var(--label)' }}>CA TƯƠNG TỰ</div>
            <div>
              <span className="mono" style={{ fontWeight: 600 }}>{similar.id}</span> · {period.slice(5)}/{period.slice(0, 4)} · {lc(attr(similar, 'symptom'))} cũng từ Supplier S1.
              Đã xử lý bằng {lc(attr(similar, 'resolution'))} {similarDoc && <span className="cite">{similarDoc.doc_id}</span>}
            </div>
            <div className="mut">Nối bằng khoá chính xác (bậc 1) qua mã linh kiện 6203 và NCC S1.</div>
          </div>
        )}
      </div>
      <div style={{ width: 340, flex: 'none', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '10px 14px 6px', fontWeight: 600 }}>Tài liệu gắn với LOT-B / 6203</div>
        <DocList docs={docs} />
      </div>
    </div>
  )
}
