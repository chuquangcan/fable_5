import { useEffect, useRef, useState } from 'react'
import { getReportDraft } from '../api/client'
import type { ReportDraft, ReportSegment } from '../api/types'
import { CiteChip } from '../agent/AgentPanel'

const fmt = (n: number) => n.toLocaleString('en-US')
const TONE = {
  bad: { border: '#C62828', bg: '#FDECEC', ink: '#A61B1B' },
  suspect: { border: '#E3BC72', bg: '#FFF4E5', ink: '#7A4300' },
  neutral: { border: '#8E959F', bg: '#FFFFFF', ink: '#1B1F24' },
}

const Segments = ({ segs }: { segs: ReportSegment[] }) => (
  <>{segs.map((s, i) => (s.kind === 'text' ? <span key={i}>{s.text}</span> : <CiteChip key={i} label={s.label} target_id={s.target_id} />))}</>
)

const H = ({ children }: { children: string }) => (
  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: 'var(--label)', margin: '16px 0 6px' }}>{children}</div>
)

const Tile = ({ label, value, bg, ink }: { label: string; value: string; bg: string; ink?: string }) => (
  <div style={{ background: bg, padding: '8px 10px' }}>
    <div className={ink ? undefined : 'mut'} style={{ fontSize: 11, color: ink }}>{label}</div>
    <div className="mono" style={{ fontSize: 18, fontWeight: 500, color: ink }}>{value}</div>
  </div>
)

export function ReportView({ claimId }: { claimId: string }) {
  const [draft, setDraft] = useState<ReportDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    let stale = false
    setDraft(null); setError(null)
    getReportDraft(claimId).then((d) => { if (!stale) setDraft(d) }, (e: Error) => { if (!stale) setError(e.message) })
    return () => { stale = true }
  }, [claimId])
  useEffect(() => () => clearTimeout(timer.current), [])

  const show = (msg: string) => {
    setToast(msg)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 2500)
  }

  if (error) return <div className="mut" style={{ padding: 16 }}>Could not create the report draft: {error}</div>
  if (!draft) return <div className="mut" style={{ padding: 16 }}>Creating the report draft…</div>
  const imp = draft.impact
  const held = imp.shipments.filter((s) => s.status !== 'delivered')

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#D9DCE0', padding: '16px 0', position: 'relative' }}>
      <article style={{ width: 680, maxWidth: 'calc(100% - 24px)', margin: '0 auto', background: '#FFFFFF', border: '1px solid var(--line)', padding: '20px 28px 24px', lineHeight: 1.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="mono mut">{draft.id}</span>
          <span className="chip" style={{ borderStyle: 'dotted' }}>draft · not approved</span>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={() => show('Demo: PDF export not available')}>Export PDF</button>
          <button className="btn pri" onClick={() => show('Demo: sending not available')}>Send to Quality</button>
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: '12px 0 2px' }}>{draft.title}</h1>
        <div className="mut">{draft.subtitle}</div>

        <H>SUMMARY</H>
        <div><Segments segs={draft.summary} /></div>

        <H>TRACE CHAIN</H>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          {draft.chain.map((c, i) => (
            <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span className="mut">→</span>}
              <span className="mono" style={{ border: `1px solid ${TONE[c.tone].border}`, background: TONE[c.tone].bg, color: TONE[c.tone].ink, padding: '2px 6px', fontSize: 11 }}>{c.label}</span>
            </span>
          ))}
        </div>

        <H>IMPACT SCOPE</H>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          <Tile label={`Parts using ${imp.lot}`} value={fmt(imp.parts)} bg="var(--panel)" />
          <Tile label="Boxes" value={fmt(imp.boxes)} bg="var(--panel)" />
          <Tile label="Delivered to customers" value={fmt(imp.delivered_parts)} bg="var(--red-bg)" ink="var(--red-ink)" />
          <Tile label="Trong kho" value={fmt(imp.held_parts)} bg="var(--amber-bg)" ink="var(--amber-ink)" />
        </div>
        <div className="mut" style={{ marginTop: 4, fontSize: 11 }}>
          {imp.shipments.length} shipments: {imp.delivered_shipments} delivered · {held.length} still in warehouse
        </div>

        <H>ROOT CAUSE</H>
        <div><Segments segs={draft.cause} /></div>

        <H>PROPOSED ACTIONS</H>
        <ol style={{ margin: 0, paddingLeft: 18, listStyle: 'decimal', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {draft.actions.map((a) => <li key={a}>{a}</li>)}
        </ol>
      </article>
      {toast && (
        <div role="status" style={{ position: 'absolute', right: 16, bottom: 16, background: '#1C2026', color: '#FFFFFF', padding: '8px 12px', fontSize: 12 }}>{toast}</div>
      )}
    </div>
  )
}
