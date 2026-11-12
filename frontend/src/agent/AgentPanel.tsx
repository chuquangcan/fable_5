import { Fragment, type ReactNode, useEffect, useState } from 'react'
import { activeProduct, useDemo } from '../store/demo'
import { useAgentMode } from './mode'
import type { AgentState, Segment } from './reducer'
import { STORY_CLAIM } from '../lib/story'
import { DEMO_QUESTION } from './sources'
import { useAgent } from './useAgent'

export function CiteChip({ label, target_id }: { label: string; target_id: string | null }) {
  const goTo = useDemo((s) => s.goTo)
  if (target_id === null) return <span className="cite">{label}</span>
  // one navigation entry: documents open a tab, nodes on the open thread are focused, other objects open in the dock
  const open = () => void goTo(target_id)
  return (
    <button
      className="cite"
      style={{ cursor: 'pointer' }}
      onClick={open}
    >
      {label}
    </button>
  )
}

export const formatToolCall = (name: string, args: Record<string, unknown>) => {
  const show = (v: unknown) => (Array.isArray(v) ? v.join('|') : String(v))
  const parts = Object.entries(args).map(([k, v], i) => (i === 0 ? show(v) : `${k}=${show(v)}`))
  return `${name}(${parts.join(', ')})`
}

const LABELS = /^(Probable cause:|Ruled out:|Impact scope:)/

/** Splits segments into paragraphs on blank lines; cites stay inline. */
function paragraphs(segments: Segment[]): Segment[][] {
  const out: Segment[][] = [[]]
  for (const seg of segments) {
    if (seg.kind === 'cite') { out[out.length - 1].push(seg); continue }
    seg.text.split('\n\n').forEach((piece, i) => {
      if (i > 0) out.push([])
      if (piece) out[out.length - 1].push({ kind: 'text', text: piece })
    })
  }
  return out.filter((p) => p.length > 0)
}

function Paragraph({ segs, index }: { segs: Segment[]; index: number }) {
  const first = segs[0]
  const label = first.kind === 'text' ? LABELS.exec(first.text.trimStart())?.[0] : undefined
  const nodes: ReactNode[] = segs.map((s, i) => {
    if (s.kind === 'cite') return <CiteChip key={i} label={s.label} target_id={s.target_id} />
    const text = i === 0 && label ? s.text.trimStart().slice(label.length) : s.text
    return <Fragment key={i}>{text}</Fragment>
  })
  return (
    <div style={index >= 4 && !label ? { borderLeft: '2px solid var(--teal)', paddingLeft: 8, color: 'var(--muted)' } : undefined}>
      {label && <b style={{ fontWeight: 600 }}>{label}</b>}
      {nodes}
    </div>
  )
}

function Answer({ state }: { state: AgentState }) {
  const paras = paragraphs(state.segments)
  return <>{paras.map((p, i) => <Paragraph key={i} segs={p} index={i} />)}</>
}

const COMMANDS = ['/trace', '/as-of', '/impact']

export function AgentPanel() {
  const { state, ask, clear } = useAgent()
  // demo controls (reset, ?step=4) drive the panel through the store
  const cmd = useDemo((s) => s.agentCmd)
  useEffect(() => {
    if (cmd.kind === 'clear') clear()
    else if (cmd.kind === 'ask' && cmd.question) ask(cmd.question)
  }, [cmd, ask, clear])
  const claimId = useDemo((s) => activeProduct(s)?.p.claimId ?? null)
  const productTab = useDemo((s) => activeProduct(s)?.tabId ?? null)
  const openReport = useDemo((s) => s.openReport)
  const setEvidence = useDemo((s) => s.setEvidence)
  const [draft, setDraft] = useState('')
  const replay = useAgentMode((s) => s.replay)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === 'KeyD') { e.preventDefault(); useAgentMode.getState().toggle() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const send = () => { ask(draft.trim() || DEMO_QUESTION); setDraft('') }

  return (
    <>
      <div style={{ height: 32, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', borderBottom: '1px solid var(--line-soft)', background: '#ECEEF1' }}>
        <span style={{ fontWeight: 600 }}>Agent</span>
        {replay && <span title="Replay (Alt+Shift+D)" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)' }} />}
        <span className="chip thr">Context · {claimId ?? '—'}</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 9, lineHeight: 1.5 }}>
        {state.status === 'idle' && (
          <div className="mut">Ask about this claim, or press <span className="mono">/report</span> to run the demo script.</div>
        )}
        {state.status !== 'idle' && (
          <div style={{ alignSelf: 'flex-end', maxWidth: '92%', background: '#E9ECEF', border: '1px solid var(--line-soft)', padding: '6px 8px' }}>{state.question}</div>
        )}
        {state.toolCalls.length > 0 && (
          <div style={{ fontSize: 11, color: '#3A4049', border: '1px dashed var(--line)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: 'var(--muted)' }}>
              ▾ {state.toolCalls.length} tool calls · read-only{state.status === 'done' ? ` · ${state.elapsed_s} s` : ' · running…'}
            </span>
            {state.toolCalls.map((c, i) => <span key={i} className="mono">{formatToolCall(c.name, c.args)}</span>)}
          </div>
        )}
        <Answer state={state} />
        {state.status === 'error' && <div style={{ color: 'var(--red-ink)' }}>Agent error: {state.error}</div>}
        {state.actions.length > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {state.actions.includes('open_report') && <button className="btn pri" onClick={() => openReport(claimId ?? STORY_CLAIM)}>Create report draft</button>}
            {state.actions.includes('open_impact') && productTab && <button className="btn" onClick={() => setEvidence(productTab, 'impact')}>View impact scope</button>}
          </div>
        )}
      </div>
      <div style={{ borderTop: '1px solid var(--line-soft)', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {COMMANDS.map((c) => <button key={c} className="chip" onClick={() => setDraft(`${c} `)}>{c}</button>)}
          <button className="chip thr" onClick={() => ask(DEMO_QUESTION)}>/report</button>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ position: 'absolute', left: -9999 }}>Ask the agent</span>
          <textarea
            rows={2} value={draft} placeholder="Ask about this claim…" onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            style={{ resize: 'none', font: 'inherit', fontSize: 12, border: '1px solid #B9BEC6', borderRadius: 2, padding: 6, background: '#FFFFFF', color: 'var(--ink)' }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mut" style={{ fontSize: 11 }}>Every finding cites its source · read-only</span>
          <button className="btn pri" onClick={send}>Send</button>
        </div>
      </div>
    </>
  )
}
