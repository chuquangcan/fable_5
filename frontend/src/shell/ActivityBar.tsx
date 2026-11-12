import type { ReactNode } from 'react'
import { activeProduct, type Rail, useDemo } from '../store/demo'
import { useFeed } from '../feed/useFeed'
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

const RAILS: { id: Rail; label: string; icon: ReactNode }[] = [
  { id: 'feed', label: 'Notifications', icon: <><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 004 0" /></> },
  { id: 'assets', label: 'Assets', icon: <path d="M3 20V10l5 3v-3l5 3v-3l5 3V4h3v16z" /> },
  {
    id: 'data', label: 'Data repository',
    icon: <><ellipse cx="12" cy="6" rx="7" ry="2.6" /><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6" /></>,
  },
]

/** Swaps the left rail only; open tabs stay as they are. */
export function ActivityBar() {
  const feed = useFeed()
  const read = useDemo((s) => s.feed.read)
  const unread = feed.status === 'ok' ? feed.data.filter((i) => !read.includes(i.id)).length : 0
  const rail = useDemo((s) => s.layout.rail)
  const setRail = useDemo((s) => s.setRail)
  const agentOpen = useDemo((s) => s.agentOpen)
  const toggleAgent = useDemo((s) => s.toggleAgent)
  const claimId = useDemo((s) => activeProduct(s)?.p.claimId ?? null)
  const reportOn = useDemo((s) => s.groups.main.active?.startsWith('report:') ?? false)
  const reviews = useReviewCount()
  return (
    <nav aria-label="Views" className="activity">
      {RAILS.map((r) => (
        <button
          key={r.id} className={`ab${rail === r.id ? ' on' : ''}`} title={r.label} aria-label={r.label}
          aria-pressed={rail === r.id} onClick={() => setRail(r.id)}
        >
          <Icon>{r.icon}</Icon>
          {r.id === 'feed' && unread > 0 && <Badge n={unread} bg="var(--red)" />}
          {r.id === 'data' && !!reviews && <Badge n={reviews} bg="var(--teal)" />}
        </button>
      ))}
      <button
        className={`ab${reportOn ? ' on' : ''}`} title={claimId ? `RCA report draft · ${claimId}` : 'Open a product tab with a claim to create a report'}
        aria-label="Report" disabled={!claimId} onClick={() => claimId && useDemo.getState().openReport(claimId)}
      >
        <Icon><path d="M5 3h14v18H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></Icon>
      </button>
      <div style={{ flex: 1 }} />
      <button className={`ab${agentOpen ? ' on' : ''}`} title={agentOpen ? 'Hide Agent' : 'Show Agent'} aria-label="Agent" aria-pressed={agentOpen} onClick={toggleAgent}>
        <Icon><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></Icon>
      </button>
    </nav>
  )
}
