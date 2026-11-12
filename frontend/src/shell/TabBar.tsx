import { type MainTab, useDemo } from '../store/demo'

export function TabBar() {
  const openTabs = useDemo((s) => s.openTabs)
  const activeTab = useDemo((s) => s.activeTab)
  const claimId = useDemo((s) => s.claimId)
  const root = useDemo((s) => s.threadRoot)
  const setTab = useDemo((s) => s.setTab)
  const closeTab = useDemo((s) => s.closeTab)
  const label: Record<MainTab, string> = {
    claim: `${claimId ?? ''} · claim`,
    thread: `Thread · ${root ?? '…'}`,
    report: 'RCA report · draft',
  }
  if (openTabs.length === 0) return null
  return (
    <div role="tablist" aria-label="Open tabs" style={{ height: 32, flex: 'none', display: 'flex', background: '#ECEEF1', borderBottom: '1px solid var(--line)' }}>
      {openTabs.map((t) => (
        <div key={t} className={`tab${t === activeTab ? ' on' : ''}`}>
          <button role="tab" aria-selected={t === activeTab} className="tab-btn" onClick={() => setTab(t)}>
            {t === 'claim' && <span style={{ width: 6, height: 6, background: 'var(--red)' }} />}
            {label[t]}
          </button>
          <button className="xbtn" aria-label={`Close ${label[t]}`} onClick={() => closeTab(t)}>✕</button>
        </div>
      ))}
    </div>
  )
}
