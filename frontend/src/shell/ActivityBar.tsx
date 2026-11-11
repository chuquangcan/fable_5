import type { ReactNode } from 'react'
import { type View, useDemo } from '../store/demo'
import { useReviewCount } from './useReviewCount'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {children}
    </svg>
  )
}

function Badge({ n, bg }: { n: number; bg: string }) {
  return <span className="ab-badge" style={{ background: bg }}>{n}</span>
}

const VIEWS: { id: View; label: string; icon: ReactNode }[] = [
  {
    id: 'product', label: 'Truy vết sản phẩm',
    icon: <><circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="8" r="2.2" /><circle cx="9" cy="18" r="2.2" /><path d="M8.2 6.3l7.6 1.3M6.6 8.2l1.8 7.6M16.6 9.8l-6.2 6.6" /></>,
  },
  { id: 'plant', label: 'Nhà máy', icon: <path d="M3 20V10l5 3v-3l5 3v-3l5 3V4h3v16z" /> },
  {
    id: 'data', label: 'Kho dữ liệu',
    icon: <><ellipse cx="12" cy="6" rx="7" ry="2.6" /><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6" /></>,
  },
]

export function ActivityBar() {
  const view = useDemo((s) => s.view)
  const setView = useDemo((s) => s.setView)
  const agentOpen = useDemo((s) => s.agentOpen)
  const toggleAgent = useDemo((s) => s.toggleAgent)
  const claimId = useDemo((s) => s.claimId)
  const reportOn = useDemo((s) => s.view === 'product' && s.activeTab === 'report')
  const reviews = useReviewCount()
  return (
    <nav aria-label="Views" className="activity">
      {VIEWS.map((v) => (
        <button
          key={v.id} className={`ab${view === v.id ? ' on' : ''}`} title={v.label} aria-label={v.label}
          aria-current={view === v.id ? 'page' : undefined} onClick={() => setView(v.id)}
        >
          <Icon>{v.icon}</Icon>
          {v.id === 'data' && !!reviews && <Badge n={reviews} bg="var(--teal)" />}
        </button>
      ))}
      <button
        className={`ab${reportOn ? ' on' : ''}`} title={claimId ? 'Nháp báo cáo RCA' : 'Mở một claim để tạo báo cáo'} aria-label="Báo cáo"
        disabled={!claimId} onClick={() => useDemo.getState().setTab('report')}
      >
        <Icon><path d="M5 3h14v18H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></Icon>
      </button>
      <div style={{ flex: 1 }} />
      <button className={`ab${agentOpen ? ' on' : ''}`} title={agentOpen ? 'Ẩn Agent' : 'Hiện Agent'} aria-label="Agent" aria-pressed={agentOpen} onClick={toggleAgent}>
        <Icon><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></Icon>
      </button>
    </nav>
  )
}
