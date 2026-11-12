import type { CSSProperties } from 'react'
import { Pending } from '../evidence/useAsync'
import { deptLabel } from '../lib/labels'
import { type FeedFilter, useDemo } from '../store/demo'
import { FeedCard } from './FeedCard'
import { feedFilter, useFeed } from './useFeed'

const CHIPS: { kind: FeedFilter; label: string }[] = [
  { kind: 'all', label: 'All' },
  { kind: 'alert', label: 'Alerts' },
  { kind: '4m', label: '4M changes' },
  { kind: 'link', label: 'Pending review' },
  { kind: 'doc', label: 'Documents' },
  { kind: 'claim', label: 'Claims' },
]

/** Left rail "Notifications & changes": alerts, 4M changes, documents, links to review and claims, newest first. */
export function FeedSidebar() {
  const feed = useFeed()
  const kind = useDemo((s) => s.feed.kind)
  const dept = useDemo((s) => s.feed.dept)
  const { setFeedFilter, setDept } = useDemo.getState()
  const byDept = feed.status === 'ok' ? feedFilter(feed.data, 'all', dept) : []
  const shown = feedFilter(byDept, kind, null)
  return (
    <>
      <div className="side-title">Notifications & changes</div>
      <div className="fchips">
        {CHIPS.map((c) => (
          <button key={c.kind} className={`fchip${kind === c.kind ? ' on' : ''}`} aria-pressed={kind === c.kind} onClick={() => setFeedFilter(c.kind)}>
            {c.label} <span className="mut">{feedFilter(byDept, c.kind, null).length}</span>
          </button>
        ))}
        {dept && (
          <span className="pill filled" style={{ '--dept': `var(--dept-${dept})` } as CSSProperties}>
            {deptLabel(dept)}
            <button className="pill-x" aria-label={`Clear department filter ${deptLabel(dept)}`} onClick={() => setDept(null)}>✕</button>
          </span>
        )}
      </div>
      <div className="feed">
        {feed.status !== 'ok' ? <Pending state={feed} /> : shown.length === 0
          ? <div className="mut" style={{ padding: 10 }}>Nothing here</div>
          : shown.map((i) => <FeedCard key={i.id} item={i} />)}
      </div>
    </>
  )
}
