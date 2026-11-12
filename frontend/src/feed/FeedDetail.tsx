import { type CSSProperties, Fragment } from 'react'
import { getDocument, getLinks } from '../api/client'
import type { EdgeStatus, FeedItem } from '../api/types'
import { Pending, useAsync } from '../evidence/useAsync'
import { deptLabel, feedStatusLabel, statusLabel } from '../lib/labels'
import { formatPlantTime } from '../lib/time'
import { useDemo } from '../store/demo'
import { useFeed } from './useFeed'

interface ReachRow { id: string; relation: string; status: EdgeStatus | 'red' | 'orange'; score: number | null }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Text with each extracted code wrapped in <mark>. */
function Marked({ text, codes }: { text: string; codes: string[] }) {
  if (codes.length === 0) return <>{text}</>
  const parts = text.split(new RegExp(`(${codes.map(escape).join('|')})`, 'g'))
  return <>{parts.map((p, i) => (codes.includes(p) ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>))}</>
}

/** What the card links to: a document's own links, else the first object's links; plus the selected card's reach. */
function useReach(item: FeedItem): { rows: ReachRow[] | null; text: { chunk_id: string; page: number | null; text: string; codes: string[] }[] | null; error: string | null } {
  const dataVersion = useDemo((s) => s.dataVersion)
  const reach = useDemo((s) => (s.feed.selected === item.id ? s.reach : null))
  const docId = item.ref.doc_id
  const first = item.objects[0] ?? null
  const base = useAsync(async () => {
    if (docId) {
      const d = await getDocument(docId)
      return {
        rows: d.links.map((l) => ({ id: l.other_id, relation: l.relation, status: l.status, score: l.score })),
        text: d.chunks.map((c) => ({ chunk_id: c.chunk_id, page: c.page, text: c.text, codes: c.extracted_codes })),
      }
    }
    if (!first) return { rows: [], text: null }
    const links = await getLinks(first)
    return { rows: links.map((l) => ({ id: l.other_id, relation: l.relation, status: l.status, score: l.score })), text: null }
  }, [docId, first, dataVersion])
  if (base.status === 'error') return { rows: null, text: null, error: base.message }
  if (base.status !== 'ok') return { rows: null, text: null, error: null }
  const extra: ReachRow[] = reach
    ? [...reach.red.map((id) => ({ id, relation: 'fault reach', status: 'red' as const, score: null })),
      ...reach.orange.map((id) => ({ id, relation: 'fault reach', status: 'orange' as const, score: null }))]
    : []
  return { rows: [...base.data.rows, ...extra], text: base.data.text, error: null }
}

function Detail({ item }: { item: FeedItem }) {
  const goTo = useDemo((s) => s.goTo)
  const { rows, text, error } = useReach(item)
  return (
    <div className="feed-detail">
      <section className="feed-detail-text">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className={`fbadge fb-${item.kind}`}>{item.badge}</span>
          <span className="mono" style={{ fontWeight: 600 }}>{item.id}</span>
          <span className="mut mono">{formatPlantTime(item.at, 'YYYY-MM-DD HH:mm')}</span>
        </div>
        <div style={{ fontWeight: 600 }}>{item.title}</div>
        <div>{item.reason}</div>
        <div className="pills">
          {item.sender && <span className="pill filled" style={{ '--dept': `var(--dept-${item.sender})` } as CSSProperties}>{deptLabel(item.sender)}</span>}
          {item.acting.filter((d) => d !== item.sender).map((d) => (
            <span key={d} className="pill outline" style={{ '--dept': `var(--dept-${d})` } as CSSProperties}>{deptLabel(d)}</span>
          ))}
          <span className={`pill st-${item.status}`}>{feedStatusLabel(item.status)}</span>
        </div>
        {text?.map((c) => (
          <p key={c.chunk_id} style={{ margin: '4px 0 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {c.page != null && <span className="mut mono" style={{ fontSize: 11 }}>{`p.${c.page} `}</span>}
            <Marked text={c.text} codes={c.codes} />
          </p>
        ))}
      </section>
      <section className="feed-detail-reach">
        {error ? <div role="alert" className="mut">{`Could not load links: ${error}`}</div> : !rows ? <Pending state={{ status: 'loading' }} /> : (
          <table className="g" aria-label="Reach">
            <thead><tr><th>Object</th><th>Relation</th><th>Status</th><th>Score</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} className="mut">Nothing linked</td></tr>}
              {rows.map((r) => (
                <tr key={`${r.id}-${r.relation}-${r.status}`}>
                  <td><button className="linkish mono" onClick={() => void goTo(r.id)}>{r.id}</button></td>
                  <td>{r.relation}</td>
                  <td>{r.status === 'red' || r.status === 'orange'
                    ? <span className={`chip reach-${r.status}`}>{r.status}</span>
                    : <span className={`chip st-${r.status}`}>{statusLabel(r.status)}</span>}</td>
                  <td className="mono">{r.score == null ? '—' : r.score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

/** Dock tab of one feed card: its text (codes marked) or notice, and what it reaches. */
export function FeedDetail({ id }: { id: string }) {
  const feed = useFeed()
  if (feed.status !== 'ok') return <Pending state={feed} />
  const item = feed.data.find((i) => i.id === id)
  if (!item) return <div className="mut" style={{ padding: 14 }}>This item is no longer in the feed</div>
  return <Detail key={item.id} item={item} />
}
