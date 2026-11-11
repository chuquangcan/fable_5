import { useEffect, useRef, useState, type DragEvent } from 'react'
import { attachSample, getSummary, listSamples, uploadDocument } from '../api/client'
import type { AttachMethod, AttachResult } from '../api/types'
import { useDemo } from '../store/demo'

/** Summary types that are not objects, so the backend would reject them as a target hint (422). */
const NOT_ATTACHABLE = new Set(['aggregate', 'document', 'event', 'source'])

const METHOD_LABEL: Record<AttachMethod, string> = { code: 'Mã', rule: 'Quy tắc', llm: 'LLM', manual: 'Thủ công' }

function ResultCard({ r }: { r: AttachResult }) {
  return (
    <div data-testid="attach-result" className="it" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="mono" style={{ fontWeight: 600 }}>{r.doc_id}</span>
        <span className="chip">{r.type}</span>
        <span className="chip" title="Cách phân loại" style={{ borderColor: 'var(--teal)', color: 'var(--teal-ink)' }}>{METHOD_LABEL[r.method] ?? r.method}</span>
      </div>
      {r.links.length === 0 ? (
        <span className="mut">Chưa gắn được vào node nào</span>
      ) : (
        r.links.map((l) => (
          <div key={l.to_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="mut">Đích</span>
            <span className="mono">{l.to_id}</span>
            <span className="chip">{`${l.status} · ${l.score}`}</span>
          </div>
        ))
      )}
      <span className="mut">{r.reason}</span>
      {r.duplicate && <span style={{ color: 'var(--amber-ink)' }}>Tài liệu đã gắn trước đó</span>}
    </div>
  )
}

function Dialog() {
  const closeAttach = useDemo((s) => s.closeAttach)
  // Same default as the overview: the focused node, else the thread's root serial.
  const target = useDemo((s) => s.focusNodeId ?? s.threadRoot)
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

  useEffect(() => {
    ref.current?.focus()
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
        ref={ref} role="dialog" aria-modal="true" aria-labelledby="attach-title" tabIndex={-1}
        style={{ width: 460, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: '#fff', border: '1px solid var(--line)', borderRadius: 2, boxShadow: '0 8px 28px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column', outline: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--line-soft)' }}>
          <span id="attach-title" style={{ fontWeight: 600, flex: 1 }}>Gắn tài liệu</span>
          <button className="btn" aria-label="Đóng" onClick={closeAttach}>✕</button>
        </div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            style={{ border: `1px dashed ${over ? 'var(--teal)' : '#B9BEC6'}`, background: over ? 'var(--teal-bg)' : '#FAFAFB', borderRadius: 2, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
          >
            <span>Kéo thả tệp vào đây hoặc chọn tệp</span>
            <input type="file" aria-label="Chọn tệp" disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
            <span className="mut" style={{ fontSize: 11 }}>
              {!target ? 'Chưa chọn node — tài liệu không có mã sẽ bị từ chối'
                : !hint ? `Đang kiểm tra ${target}…`
                : hint.ok ? `Đích gợi ý khi không nhận ra mã: ${target}`
                : `${target} không phải đối tượng — tài liệu không có mã sẽ bị từ chối`}
            </span>
          </div>
          {samples.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="mut" style={{ fontSize: 11 }}>Hoặc dùng tệp mẫu</span>
              {samples.map((n) => (
                <button key={n} className="btn" disabled={busy} style={{ justifyContent: 'flex-start', height: 28 }} onClick={() => void run(() => attachSample(n))}>{n}</button>
              ))}
            </div>
          )}
          {busy && <span className="mut">Đang gắn…</span>}
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
