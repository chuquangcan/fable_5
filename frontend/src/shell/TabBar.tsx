import { type MainTab, useDemo } from '../store/demo'

const SERIAL = 'MH20-0001'

export function TabBar() {
  const { openTabs, activeTab, claimId, setTab } = useDemo()
  const label: Record<MainTab, string> = {
    claim: `${claimId ?? ''} · claim`,
    thread: `Thread · ${SERIAL}`,
    report: 'Report · nháp',
  }
  return (
    <div style={{ height: 32, flex: 'none', display: 'flex', background: '#ECEEF1', borderBottom: '1px solid var(--line)' }}>
      {openTabs.map((t) => (
        <button key={t} className={`tab${t === activeTab ? ' on' : ''}`} onClick={() => setTab(t)}>
          {t === 'claim' && <span style={{ width: 6, height: 6, background: 'var(--red)' }} />}
          {label[t]}
          <span className="mut">×</span>
        </button>
      ))}
    </div>
  )
}
