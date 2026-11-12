import { getDocs, getLotCompare } from '../api/client'
import type { DocView } from '../api/types'
import { DocList } from '../docs/DocList'
import { statusLabel } from '../lib/labels'
import { formatPlantTime } from '../lib/time'
import { useDemo } from '../store/demo'
import { Pending, useAsync } from './useAsync'

async function load(id: string) {
  const cmp = await getLotCompare(id)
  const docLists = await Promise.all([getDocs(cmp.lot), ...cmp.similar.map((c) => getDocs(c.id))])
  const docs = new Map<string, DocView>()
  for (const d of docLists.flat()) if (!docs.has(d.doc_id)) docs.set(d.doc_id, d)
  return { cmp, docs: [...docs.values()] }
}

const lc = (v: string | null) => (v ? v.charAt(0).toLowerCase() + v.slice(1) : '')
const short = (id: string | null) => (id ? id.replace(/^SUP-/, '') : '—')

/** Incoming inspection of a lot next to the other lots of the same part, plus similar closed claims. */
export function LotTab({ lotId }: { lotId: string }) {
  const dataVersion = useDemo((s) => s.dataVersion)
  const goTo = useDemo((s) => s.goTo)
  const s = useAsync(() => load(lotId), [lotId, dataVersion])
  if (s.status !== 'ok') return <Pending state={s} />
  const { cmp, docs } = s.data
  const spec = cmp.rows.find((r) => r.spec_doc) ?? cmp.rows.find((r) => r.spec_min != null)
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line-faint)' }}>
        <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>{`Incoming inspection · ${cmp.part_name ?? cmp.part ?? cmp.lot}`}</span>
          {spec && <span className="mut">spec Cpk ≥ {spec.spec_min}{spec.spec_doc ? ` theo ${spec.spec_doc}${spec.spec_page ? ` p.${spec.spec_page}` : ''}` : ''}</span>}
        </div>
        <table className="g">
          <thead><tr><th>Lot</th><th>Received</th><th>Supplier</th><th>Cpk</th><th>IQC verdict</th><th>Source</th></tr></thead>
          <tbody>
            {cmp.rows.map((r) => {
              const fail = r.cpk != null && r.spec_min != null && r.cpk < r.spec_min
              const self = r.lot === cmp.lot
              return (
                <tr key={r.lot} style={fail ? { background: 'var(--red-bg)' } : undefined}>
                  <td className="mono" style={{ ...(fail ? { color: 'var(--amber-ink)' } : {}), ...(self ? { fontWeight: 600 } : {}) }}>{r.lot}</td>
                  <td className="mono">{r.received_at ? formatPlantTime(r.received_at, 'YYYY-MM-DD HH:mm').slice(0, 10) : '—'}</td>
                  <td>{short(r.supplier)}</td>
                  <td className="mono" style={fail ? { color: 'var(--red-ink)', fontWeight: 600 } : undefined}>{r.cpk?.toFixed(2) ?? '—'}</td>
                  <td style={fail ? { color: 'var(--red-ink)' } : undefined}>{r.verdict ?? '—'}</td>
                  <td><span className="cite">{r.iqc ?? r.lot}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {cmp.similar.length > 0 && (
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.45 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: 'var(--label)' }}>SIMILAR CASES</div>
            {cmp.similar.map((c) => (
              <div key={c.id}>
                <div>
                  <button className="linkish mono" style={{ fontWeight: 600 }} onClick={() => goTo(c.id)}>{c.id}</button>
                  {c.period ? ` · ${c.period.slice(5)}/${c.period.slice(0, 4)}` : ''} · {lc(c.symptom)} also involved {c.via}.
                  {c.resolution ? ` Resolved by ${lc(c.resolution)} ` : ' '}
                  {c.docs.map((d) => <span key={d} className="cite">{d}</span>)}
                </div>
                <div className="mut">{`Linked via ${c.via} · tier ${c.tier} · ${statusLabel(c.status).toLowerCase()}`}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ width: 340, flex: 'none', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '10px 14px 6px', fontWeight: 600 }}>{`Documents attached to ${cmp.lot}${cmp.similar.length ? ' and similar cases' : ''}`}</div>
        {docs.length ? <DocList docs={docs} /> : <div className="mut" style={{ padding: '0 14px' }}>No documents yet</div>}
      </div>
    </div>
  )
}
