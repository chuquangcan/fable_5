import type { DocView } from '../api/types'

export const docTitle = (d: DocView) => (d.page && d.page > 1 ? `${d.doc_id} · p.${d.page}` : d.doc_id)

export function DocBadge({ d }: { d: DocView }) {
  if (d.status === 'pending') return <span className="chip" style={{ borderStyle: 'dotted', color: 'var(--teal-ink)' }}>{`pending review · ${d.score?.toFixed(2)}`}</span>
  // Machine-attached (auto-match, not yet reviewed): never shown as human-approved.
  if (d.status === 'inferred') return <span className="chip" style={{ borderStyle: 'dashed' }}>{`tier ${d.tier} · automatic ${d.score?.toFixed(2) ?? '—'}`}</span>
  if (d.status === 'suggested') return <span className="chip" style={{ borderStyle: 'dotted' }}>{`suggestion only · tier ${d.tier}`}</span>
  return (
    <span className="chip"><span className="ln" style={{ width: 14, borderTop: '2px solid #0E7C86' }} />{`tier ${d.tier} · approved`}</span>
  )
}
