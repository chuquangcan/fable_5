import { getProvider } from '../api/client'
import { useAsync } from '../evidence/useAsync'
import { formatPlantTime } from '../lib/time'
import { activeMain, activeProduct, useDemo } from '../store/demo'
import { useReviewCount } from './useReviewCount'

const CURSOR = '2026-11-03T14:05:00+07:00'
const ticks: { label: string; style: React.CSSProperties }[] = [
  { label: '10-28', style: { left: 6 } },
  { label: '11-23', style: { left: '25%' } },
  { label: '12-20', style: { left: '50%' } },
  { label: '01-16', style: { left: '75%' } },
  { label: '02-12', style: { right: 6 } },
]

const abs = (style: React.CSSProperties): React.CSSProperties => ({ position: 'absolute', ...style })
const diamond = (style: React.CSSProperties): React.CSSProperties => abs({ background: 'var(--teal)', transform: 'rotate(45deg)', ...style })

/** The claim's journey (story timeline); only meaningful next to its thread. */
function Journey() {
  return (
    <div style={{ height: 50, display: 'flex', background: 'var(--panel)', borderTop: '1px solid #A9AEB6' }}>
      <div style={{ width: 264, flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', borderRight: '1px solid var(--line)' }}>
        <span className="mut" style={{ fontSize: 11 }}>Serial journey · pressed at</span>
        <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 500 }}>
          {formatPlantTime(CURSOR)}
        </span>
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div className="mono" style={abs({ left: 0, right: 0, top: 2, height: 12, fontSize: 11, color: 'var(--muted)' })}>
          {ticks.map((t) => <span key={t.label} style={abs(t.style)}>{t.label}</span>)}
        </div>
        <div style={abs({ left: 6, top: 19, width: 9, height: 9, background: 'var(--amber)', transform: 'rotate(45deg)' })} />
        <span style={abs({ left: 18, top: 16, fontSize: 11, color: 'var(--amber-ink)' })}>LOT-B received</span>
        <div style={diamond({ left: '14%', top: 31, width: 9, height: 9 })} />
        <span style={abs({ left: '15.2%', top: 28, fontSize: 11, color: 'var(--teal-ink)' })}>giao C3 11-12</span>
        <div style={abs({ left: '14%', width: '83%', top: 42, height: 4, background: 'var(--line-faint)' })} />
        <span style={abs({ left: '45%', top: 28, fontSize: 11, color: 'var(--muted)' })}>customer used 3 months</span>
        <div style={abs({ left: '97.4%', top: 16, width: 10, height: 10, background: 'var(--red)', transform: 'rotate(45deg)' })} />
        <span style={abs({ right: 22, top: 28, fontSize: 11, color: 'var(--red-ink)', fontWeight: 600 })}>CLM-0012 02-10</span>
        <div style={abs({ left: '5.6%', top: 0, bottom: 0, width: 2, background: 'var(--header)' })} />
        <div style={abs({ left: '5.6%', top: 0, width: 8, height: 8, marginLeft: -3, background: 'var(--header)' })} />
      </div>
    </div>
  )
}

const openReview = () => useDemo.getState().openTab('bottom', { id: 'review', kind: 'review', target: 'queue', title: 'Review queue' })

export function StatusBar() {
  const title = useDemo((s) => activeMain(s)?.title ?? '')
  // the claim's journey only means something next to a product tab that has a claim
  const journey = useDemo((s) => activeProduct(s)?.p.claimId === 'CLM-0012')
  const reviews = useReviewCount()
  const p = useAsync(getProvider, [])
  const agent = p.status !== 'ok' ? 'Agent: …'
    : p.data.provider ? `Agent: ${p.data.provider} · ${p.data.mode}` : `Agent: replay (no API key) · ${p.data.mode}`
  return (
    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column' }}>
      {journey && <Journey />}
      <div className="statusline">
        <span>{title}</span>
        <span>DEMO · sample data · read-only</span>
        <button className="sbtn" onClick={openReview}>{`Review queue ${reviews ?? '…'}`}</button>
        <span style={{ marginLeft: 'auto' }}>{agent}</span>
        <span>UTC+7</span>
        <span>One Thread demo v0.2</span>
      </div>
    </div>
  )
}
