import { formatPlantTime } from '../lib/time'

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

export function StatusBar() {
  return (
    <div style={{ height: 78, flex: 'none', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 56, display: 'flex', background: 'var(--panel)', borderTop: '1px solid #A9AEB6' }}>
        <div style={{ width: 312, flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', borderRight: '1px solid var(--line)' }}>
          <span className="mut" style={{ fontSize: 11 }}>Hành trình serial</span>
          <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 500 }}>
            {formatPlantTime(CURSOR)}
          </span>
        </div>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div className="mono" style={abs({ left: 0, right: 0, top: 2, height: 12, fontSize: 11, color: 'var(--muted)' })}>
            {ticks.map((t) => <span key={t.label} style={abs(t.style)}>{t.label}</span>)}
          </div>
          <div style={abs({ left: 6, top: 20, width: 9, height: 9, background: 'var(--amber)', transform: 'rotate(45deg)' })} />
          <span style={abs({ left: 18, top: 17, fontSize: 11, color: 'var(--amber-ink)' })}>LOT-B nhập kho</span>
          <div style={diamond({ left: '14%', top: 34, width: 9, height: 9 })} />
          <span style={abs({ left: '15.2%', top: 31, fontSize: 11, color: 'var(--teal-ink)' })}>giao C3 11-12</span>
          <div style={abs({ left: '14%', width: '83%', top: 46, height: 4, background: 'var(--line-faint)' })} />
          <span style={abs({ left: '45%', top: 31, fontSize: 11, color: 'var(--muted)' })}>khách dùng 3 tháng</span>
          <div style={abs({ left: '97.4%', top: 16, width: 10, height: 10, background: 'var(--red)', transform: 'rotate(45deg)' })} />
          <span style={abs({ right: 22, top: 30, fontSize: 11, color: 'var(--red-ink)', fontWeight: 600 })}>CLM-0012 02-10</span>
          <div style={abs({ left: '5.6%', top: 0, bottom: 0, width: 2, background: 'var(--header)' })} />
          <div style={abs({ left: '5.6%', top: 0, width: 8, height: 8, marginLeft: -3, background: 'var(--header)' })} />
        </div>
        <div style={{ width: 200, flex: 'none', borderLeft: '1px solid var(--line)', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
          <span className="mut" style={{ fontSize: 11 }}>Kịch bản demo</span>
          <span style={{ fontSize: 11 }}>Bước 2–4 / 4 · trace → bằng chứng → RCA</span>
        </div>
      </div>
      <div style={{ height: 22, background: 'var(--header)', color: '#C9CFD6', display: 'flex', alignItems: 'center', gap: 18, padding: '0 10px', fontSize: 11 }}>
        <span style={{ background: 'var(--amber)', color: '#FFFFFF', padding: '0 6px', fontWeight: 600 }}>DEMO · scripted data</span>
        <span>Line 1 · MH-20 · Bearing 6203</span>
        <span>Sources 7/7 · read-only</span>
        <span>Review queue 1</span>
        <span style={{ marginLeft: 'auto' }}>Agent: Claude · live, có fallback DEMO_MODE</span>
        <span>UTC+7</span>
        <span>One Thread demo v0.1</span>
      </div>
    </div>
  )
}
