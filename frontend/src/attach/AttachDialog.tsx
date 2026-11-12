import { useEffect, useRef, useState, type DragEvent } from 'react'
import { attachSample, getSummary, listSamples, uploadDocument } from '../api/client'
import type { AttachMethod, AttachResult } from '../api/types'
import { NOT_ATTACHABLE } from '../evidence/OverviewTab'
import { useFocusTrap } from '../lib/useFocusTrap'
import { activeMain, activeProduct, useDemo } from '../store/demo'

const METHOD_LABEL: Record<AttachMethod, string> = { code: 'Code', rule: 'Rule', llm: 'LLM', manual: 'Manual' }

function ResultCard({ r }: { r: AttachResult }) {
  return (
    <div data-testid="attach-result" className="it" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="mono" style={{ fontWeight: 600 }}>{r.doc_id}</span>
        <span className="chip">{r.type}</span>
        <span className="chip" title="Classification method" style={{ borderColor: 'var(--teal)', color: 'var(--teal-ink)' }}>{METHOD_LABEL[r.method] ?? r.method}</span>
      </div>
      {r.links.length === 0 ? (
        <span className="mut">Could not be attached to any node</span>
      ) : (
        r.links.map((l) => (
          <div key={l.to_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="mut">Target</span>
            <span className="mono">{l.to_id}</span>
            <span className="chip">{`${l.status} · ${l.score}`}</span>
          </div>
        ))
      )}
      <span className="mut">{r.reason}</span>
      {r.duplicate && <span style={{ color: 'var(--amber-ink)' }}>Document was already attached</span>}
      <div>
        <button className="btn" onClick={() => { useDemo.getState().closeAttach(); useDemo.getState().openDoc(r.doc_id) }}>
          {r.links.some((l) => l.status !== 'confirmed') ? 'View details & review' : 'View details'}
        </button>
      </div>
    </div>
  )
}

function Dialog() {
  const closeAttach = useDemo((s) => s.closeAttach)
  // The node in context: the product tab's focused node (else its serial), the object selected on the twin, else none.
  const target = useDemo((s) => {
    const prod = activeProduct(s)
    if (prod) return prod.p.focusNodeId ?? prod.p.root
    return activeMain(s)?.kind === 'twin' ? s.twin.selected : null
  })
  const [checked, setChecked] = useState<{ id: string; ok: boolean } | null>(null)
  const [samples, setSamples] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AttachResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let stale = false
    listSamples().then((s) => { if (!stale) setSamples(s) }).catch(() => {})
    return () => { stale = true }
  }, [])

  useEffect(() => {
    if (!target) return
    let stale = false
    getSummary(target).then(
      (s) => { if (!stale) setChecked({ id: target, ok: !NOT_ATTACHABLE.has(s.type) }) },
      () => { if (!stale) setChecked({ id: target, ok: false }) },
    )
    return () => { stale = true }
  }, [target])
  const hint = checked && checked.id === target ? checked : null
  const hintId = hint?.ok ? hint.id : undefined

  useFocusTrap(ref)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAttach() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeAttach])

  const run = async (send: () => Promise<AttachResult>) => {
    setBusy(true)
    setError(null)
    try {
      const r = await send()
      setResult(r)
      useDemo.getState().bumpData()
      if (r.links[0]) useDemo.getState().flash(r.links[0].to_id)
    } catch (e) {
      setResult(null)
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const upload = (file: File | undefined) => { if (file) void run(() => uploadDocument(file, hintId)) }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    if (busy) return
    upload(e.dataTransfer.files[0])
  }

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) closeAttach() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(27,31,36,.4)', display: 'grid', placeItems: 'center', zIndex: 50 }}
    >
      <div
        ref={ref} role="dialog" aria-modal="true" aria-labelledby="attach-title" aria-busy={busy} tabIndex={-1}
        style={{ width: 460, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: '#fff', border: '1px solid var(--line)', borderRadius: 2, boxShadow: '0 8px 28px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column', outline: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--line-soft)' }}>
          <span id="attach-title" style={{ fontWeight: 600, flex: 1 }}>Attach document</span>
          <button className="btn" aria-label="Close" onClick={closeAttach}>✕</button>
        </div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            style={{ border: `1px dashed ${over ? 'var(--teal)' : '#B9BEC6'}`, background: over ? 'var(--teal-bg)' : '#FAFAFB', borderRadius: 2, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
          >
            <span>Drag and drop a file here or choose one</span>
            <input type="file" aria-label="Choose file" disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
            <span className="mut" style={{ fontSize: 11 }}>
              {!target ? 'No node selected — documents without a code will be rejected'
                : !hint ? `Checking ${target}…`
                : hint.ok ? `Suggested target when no code is recognised: ${target}`
                : `${target} is not an object — documents without a code will be rejected`}
            </span>
          </div>
          {samples.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="mut" style={{ fontSize: 11 }}>Or use a sample file</span>
              {samples.map((n) => (
                <button key={n} className="btn" disabled={busy} style={{ justifyContent: 'flex-start', height: 28 }} onClick={() => void run(() => attachSample(n))}>{n}</button>
              ))}
            </div>
          )}
          {busy && <span className="mut">Attaching…</span>}
          {error && <div role="alert" style={{ color: 'var(--red)' }}>{error}</div>}
          {result && <ResultCard r={result} />}
        </div>
      </div>
    </div>
  )
}

export function AttachDialog() {
  const open = useDemo((s) => s.attachOpen)
  return open ? <Dialog /> : null
}
