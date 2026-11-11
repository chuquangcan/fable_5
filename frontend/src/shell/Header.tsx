import { DEMO_NOW, formatPlantTime } from '../lib/time'

export function Header() {
  return (
    <header
      style={{
        height: 32, flex: 'none', background: 'var(--header)', color: '#E6E9ED',
        display: 'flex', alignItems: 'center', gap: 14, padding: '0 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
        <span style={{ width: 12, height: 12, border: '2px solid #3FB6C0' }} />
        One Thread
      </div>
      <span style={{ color: '#9AA3AF' }}>Plant 1 · Line 1 · Bơm nước MH-20</span>
      <span style={{ flex: 1 }} />
      <label
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: 380, height: 22, background: '#2B3038',
          border: '1px solid #3A414B', padding: '0 8px', color: '#9AA3AF',
        }}
      >
        <span style={{ position: 'absolute', left: -9999 }}>Search</span>
        <input
          placeholder="Tìm serial, lô, máy, tài liệu, claim"
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, color: '#E6E9ED', font: 'inherit', fontSize: 12, outline: 'none' }}
        />
        <span className="mono" style={{ fontSize: 11 }}>Ctrl K</span>
      </label>
      <span style={{ flex: 1 }} />
      <span className="mono" style={{ color: '#FFFFFF' }}>{formatPlantTime(DEMO_NOW, 'YYYY-MM-DD HH:mm')}</span>
      <span style={{ background: 'var(--amber)', color: '#FFFFFF', padding: '1px 6px', fontSize: 11, fontWeight: 600, letterSpacing: '.06em' }}>
        DEMO · DỮ LIỆU MẪU
      </span>
      <span style={{ color: '#C9CFD6' }}>Quality · QA engineer</span>
    </header>
  )
}
