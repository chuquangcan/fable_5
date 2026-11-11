import { useEffect, useState } from 'react'
import { getClaims, getTrace } from '../api/client'
import type { Claim, EdgeStatus, TraceGraph } from '../api/types'
import { useDemo } from '../store/demo'

/** Only this claim has a traceable serial in the demo dataset; the others render as static rows. */
const TRACEABLE = new Set(['CLM-0012'])

const LEVELS: { status: EdgeStatus; label: string; line: string; color: string }[] = [
  { status: 'confirmed', label: 'Confirmed · bậc 1–2', line: 'solid', color: '#0E7C86' },
  { status: 'inferred', label: 'Inferred · bậc 3', line: 'dashed', color: '#0E7C86' },
  { status: 'pending', label: 'Chờ duyệt · bậc 4', line: 'dotted', color: '#0E7C86' },
  { status: 'suggested', label: 'Chỉ gợi ý · bậc 5', line: 'dotted', color: '#8E959F' },
]

const ALIASES: [string, string][] = [
  ['MC-02 · PLC2 · Press 2', 'Machine 02'],
  ['S1-6203-B', 'LOT-B'],
  ['NCC-S1', 'Supplier S1'],
]

const DOC_LABEL: Record<string, string> = { meeting_minutes: 'Biên bản họp' }
const docLabel = (name: string) => name.replace(/^[a-z_]+/, (t) => DOC_LABEL[t] ?? t).replace(/ p\.(\d+)/, ' · tr.$1')

const shortDate = (d: string | null) => (d ? d.slice(5) : '')

function ClaimBody({ c, tag }: { c: Claim; tag: string }) {
  const meta = [c.customer_name, c.serial, shortDate(c.received)].filter(Boolean).join(' · ')
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="mono" style={{ fontWeight: 500 }}>{c.id}</span>
        <span className={`chip${c.status === 'open' && TRACEABLE.has(c.id) ? ' red' : ''}`}>{tag}</span>
      </div>
      {TRACEABLE.has(c.id) && c.symptom && <div>{c.symptom}</div>}
      {meta && <div className="mut">{meta}</div>}
    </>
  )
}

export function ClaimsSidebar() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [trace, setTrace] = useState<TraceGraph | null>(null)
  const claimId = useDemo((s) => s.claimId)
  const openClaim = useDemo((s) => s.openClaim)

  useEffect(() => {
    getClaims().then(setClaims).catch(() => setClaims([]))
  }, [])

  const active = claims.find((c) => c.id === claimId)
  const serial = active?.serial ?? null
  useEffect(() => {
    if (!serial) { setTrace(null); return }
    let stale = false
    getTrace(serial).then((t) => { if (!stale) setTrace(t) }).catch(() => { if (!stale) setTrace(null) })
    return () => { stale = true }
  }, [serial])

  const open = claims.filter((c) => c.status !== 'closed')
  const closed = claims.filter((c) => c.status === 'closed')
  const pending = trace?.edges.filter((e) => e.status === 'pending') ?? []
  const nodeName = (id: string) => trace?.nodes.find((n) => n.id === id)?.name

  return (
    <>
      <div style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 10px', fontWeight: 600, borderBottom: '1px solid var(--line-soft)' }}>
        Claims khách hàng
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        <div className="sec"><span>Đang mở</span><span className="mut">{open.length}</span></div>
        {open.map((c) =>
          TRACEABLE.has(c.id) ? (
            <button
              key={c.id}
              className="it"
              style={{
                textAlign: 'left', font: 'inherit', cursor: 'pointer', width: 'calc(100% - 12px)',
                ...(c.id === claimId ? { borderColor: '#1C2026', boxShadow: 'inset 3px 0 0 #1C2026' } : {}),
              }}
              onClick={() => openClaim(c.id)}
            >
              <ClaimBody c={c} tag="tiếng ồn" />
            </button>
          ) : (
            <div key={c.id} className="it"><ClaimBody c={c} tag={c.symptom?.toLowerCase() ?? c.status} /></div>
          ),
        )}

        <div className="sec"><span>Đã đóng · cùng họ linh kiện</span></div>
        {closed.map((c) => (
          <div key={c.id} className="it">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="mono">{c.id}</span><span className="chip">closed</span>
            </div>
            <div className="mut">{c.symptom}</div>
          </div>
        ))}

        {trace && (
          <>
            <div className="sec"><span>Liên kết theo độ tin cậy</span></div>
            <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {LEVELS.map((l) => (
                <div key={l.status} style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="ln" style={{ borderTop: `2px ${l.line} ${l.color}` }} />
                  <span>{l.label}</span>
                  <span className="mono" style={{ marginLeft: 'auto' }}>{trace.edges.filter((e) => e.status === l.status).length}</span>
                </div>
              ))}
            </div>

            <div className="sec"><span>Hàng đợi duyệt</span><span className="mut">{pending.length}</span></div>
            {pending.map((e) => (
              <div key={`${e.from_id}-${e.to_id}`} className="it" style={{ borderColor: '#0E7C86', boxShadow: 'inset 3px 0 0 #0E7C86' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="mono" style={{ fontWeight: 500 }}>{e.from_id} → {e.to_id}</span>
                  <span className="chip" style={{ borderStyle: 'dotted' }}>{e.score?.toFixed(2)}</span>
                </div>
                {nodeName(e.from_id) && <div className="mut">{docLabel(nodeName(e.from_id)!)}</div>}
              </div>
            ))}
          </>
        )}

        <div className="sec"><span>Alias đã hợp nhất</span></div>
        <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1.4 }}>
          {ALIASES.map(([a, b]) => (
            <span key={a}><span className="mono">{a}</span> <span className="mut">→ {b}</span></span>
          ))}
        </div>
      </div>
    </>
  )
}
