import { useState } from 'react'
import { reviewLink } from '../api/client'
import { REVIEWABLE, type ReviewDecision } from '../api/types'
import { useDemo } from '../store/demo'

/** Approve / reject one link. A decision is a demo write: every view refetches through `bumpData`. */
export function ReviewActions({ linkId, status, label, withNote = false }: {
  linkId: number
  status: string
  /** What is being decided, for screen readers (e.g. "D-07 → LOT-B"). */
  label: string
  withNote?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  if (!REVIEWABLE.includes(status)) return null
  const decide = async (d: ReviewDecision) => {
    setBusy(true)
    setError(null)
    try {
      await reviewLink(linkId, d, note.trim() || undefined)
      useDemo.getState().bumpData()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} onClick={(e) => e.stopPropagation()}>
      {withNote && (
        <input
          aria-label={`Review note ${label}`} placeholder="Note (optional)" value={note} disabled={busy}
          onChange={(e) => setNote(e.target.value)} maxLength={500} className="inp"
        />
      )}
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="btn pri" disabled={busy} aria-label={`Approve ${label}`} onClick={() => void decide('approve')}>Approve</button>
        <button className="btn" disabled={busy} aria-label={`Reject ${label}`} onClick={() => void decide('reject')}>Reject</button>
      </div>
      {error && <span role="alert" style={{ color: 'var(--red)', fontSize: 11 }}>{error}</span>}
    </div>
  )
}
