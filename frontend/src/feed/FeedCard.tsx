import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react'
import type { FeedItem } from '../api/types'
import { deptLabel, feedStatusLabel } from '../lib/labels'
import { USER_DEPT } from '../lib/story'
import { formatPlantTime } from '../lib/time'
import { ReviewActions } from '../review/ReviewActions'
import { useDemo } from '../store/demo'

const deptColor = (d: string) => ({ '--dept': `var(--dept-${d})` }) as CSSProperties
/** Pills act on their own; the click must not also select the card. */
const only = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn() }

/** One feed card: badge, id, time, title, reason, then department, object and status pills. */
export function FeedCard({ item }: { item: FeedItem }) {
  const unread = useDemo((s) => !s.feed.read.includes(item.id))
  const selected = useDemo((s) => s.feed.selected === item.id)
  const { selectCard, setDept, setHover, goTo } = useDemo.getState()
  const foreign = !!item.sender && item.sender !== USER_DEPT
  const select = () => {
    void selectCard(item)
    // a claim card opens its thread straight away when the claim can be traced (goTo checks)
    if (item.kind === 'claim') void goTo(item.ref.claim_id ?? item.id)
  }
  const onKey = (e: KeyboardEvent) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select() } }
  return (
    <article
      aria-label={item.id} tabIndex={0} className={`fcard${foreign ? ' foreign' : ''}${selected ? ' on' : ''}`}
      data-unread={unread || undefined} style={foreign ? deptColor(item.sender!) : undefined}
      onClick={select} onKeyDown={onKey} onMouseEnter={() => setHover(item.objects)} onMouseLeave={() => setHover([])}
    >
      <div className="fcard-head">
        <span className={`fbadge fb-${item.kind}`}>{item.badge}</span>
        <span className="mono" style={{ fontWeight: 600 }}>{item.id}</span>
        <span style={{ flex: 1 }} />
        <span className="mut mono">{formatPlantTime(item.at, 'MM-DD HH:mm')}</span>
        {unread && <span className="unread-dot" title="Unread" />}
      </div>
      <div className="ellipsis" style={{ fontWeight: 500 }} title={item.title}>{item.title}</div>
      <div className="mut ellipsis" title={item.reason}>{item.reason}</div>
      <div className="pills">
        {item.sender && (
          <button className="pill filled" style={deptColor(item.sender)} title="Sent by" onClick={only(() => setDept(item.sender))}>{deptLabel(item.sender)}</button>
        )}
        {item.acting.filter((d) => d !== item.sender).map((d) => (
          <button key={d} className="pill outline" style={deptColor(d)} title="Must act" onClick={only(() => setDept(d))}>{deptLabel(d)}</button>
        ))}
        {item.objects.map((o) => (
          <button key={o} className="pill obj mono" onClick={only(() => void goTo(o))}>{o}</button>
        ))}
        <span className={`pill st-${item.status}`}>{feedStatusLabel(item.status)}</span>
      </div>
      {item.kind === 'link' && item.ref.link_id != null && (
        <ReviewActions linkId={item.ref.link_id} status="pending" label={item.objects.join(' → ')} />
      )}
    </article>
  )
}
