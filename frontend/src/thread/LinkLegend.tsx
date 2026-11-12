import type { ReactNode } from 'react'
import type { EdgeStatus } from '../api/types'
import { edgeStyle, neutralEdgeStyle } from './layout'

const LEVELS: { status: EdgeStatus; label: string }[] = [
  { status: 'confirmed', label: 'confirmed' },
  { status: 'inferred', label: 'inferred' },
  { status: 'pending', label: 'pending review' },
  { status: 'suggested', label: 'suggested' },
]

/** CSS line style matching an edge's SVG dash pattern. */
const line = (dash?: string) => (!dash ? 'solid' : Number(dash.split(' ')[0]) >= 4 ? 'dashed' : 'dotted')

/** Link confidence legend, drawn with the same styles as the edges (thread and plant twin). */
export function LinkLegend({ neutral = false, counts, note }: {
  neutral?: boolean
  counts?: Partial<Record<EdgeStatus, number>>
  note?: ReactNode
}) {
  const style = neutral ? neutralEdgeStyle : edgeStyle
  return (
    <div className="mut legend" aria-label="Link confidence">
      {LEVELS.map((l) => {
        const s = style(l.status)
        return (
          <span key={l.status} data-status={l.status}>
            <span className="ln" style={{ borderTop: `2px ${line(s.strokeDasharray)} ${s.stroke}` }} />
            {l.label}{counts?.[l.status] !== undefined && <span className="mono">{` ${counts[l.status]}`}</span>}
          </span>
        )
      })}
      {note && <span>{note}</span>}
    </div>
  )
}
