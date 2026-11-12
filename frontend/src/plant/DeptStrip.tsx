import type { CSSProperties, MutableRefObject } from 'react'
import type { FeedItem } from '../api/types'
import { CHANNELS, channelLabel } from '../lib/labels'
import { useDemo } from '../store/demo'

/** One chip per department and system above the twin; a badge counts what it sent that is still unread. */
export function DeptStrip({ unread, chipRefs }: { unread: Record<string, FeedItem[]>; chipRefs: MutableRefObject<Record<string, HTMLButtonElement | null>> }) {
  const dept = useDemo((s) => s.feed.dept)
  const setDept = useDemo((s) => s.setDept)
  return (
    <div className="dept-strip" role="toolbar" aria-label="Departments">
      {CHANNELS.map((c) => {
        const n = unread[c.id]?.length ?? 0
        return (
          <button
            key={c.id} ref={(el) => { chipRefs.current[c.id] = el }} className={`dchip${dept === c.id ? ' on' : ''}`}
            style={{ '--dept': `var(--dept-${c.dept})` } as CSSProperties} aria-pressed={dept === c.id}
            onClick={() => setDept(dept === c.id ? null : c.id)}
          >
            {channelLabel(c)}
            {n > 0 && <span className="dchip-badge" title="Unread from this department">{n}</span>}
          </button>
        )
      })}
    </div>
  )
}
