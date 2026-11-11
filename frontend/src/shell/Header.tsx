import { useEffect, useRef, useState } from 'react'
import { resetDemoData, search } from '../api/client'
import type { SearchHit } from '../api/types'
import { docTypeLabel, objectTypeLabel } from '../lib/labels'
import { DEMO_NOW, formatPlantTime } from '../lib/time'
import { useDemo } from '../store/demo'

/** Claims whose serial is traceable in the demo data: picking one opens its thread. */
const TRACEABLE_CLAIMS = new Set(['CLM-0012'])

function Search() {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLInputElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const term = q.trim()
    if (!term) { setHits([]); return }
    let stale = false
    const t = setTimeout(() => {
      search(term).then((h) => { if (!stale) { setHits(h); setActive(0) } }).catch(() => { if (!stale) setHits([]) })
    }, 150)
    return () => { stale = true; clearTimeout(t) }
  }, [q])

  const pick = (h: SearchHit) => {
    const s = useDemo.getState()
    if (h.type === 'claim' && TRACEABLE_CLAIMS.has(h.id)) s.openClaim(h.id)
    else s.goTo(h.id)
    setQ('')
    setOpen(false)
    ref.current?.blur()
  }

  return (
    <div className="search">
      <label className="search-box">
        <span className="sr-only">Tìm kiếm</span>
        <input
          ref={ref} value={q} placeholder="Tìm serial, lô, máy, tài liệu, claim" role="combobox"
          aria-expanded={open && hits.length > 0} aria-controls="search-results" aria-autocomplete="list"
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => { clearTimeout(closeTimer.current); setOpen(true) }}
          onBlur={() => { closeTimer.current = setTimeout(() => setOpen(false), 120) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
            if (e.key === 'Enter' && hits[active]) pick(hits[active])
            if (e.key === 'Escape') { setOpen(false); ref.current?.blur() }
          }}
        />
        <span className="mono" style={{ fontSize: 11 }}>Ctrl K</span>
      </label>
      {open && hits.length > 0 && (
        <ul id="search-results" role="listbox" className="search-results">
          {hits.map((h, i) => (
            <li
              key={`${h.kind}-${h.id}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(h) }} onMouseEnter={() => setActive(i)}
            >
              <span className="mono" style={{ fontWeight: 500 }}>{h.id}</span>
              <span className="mut">{h.kind === 'document' ? `Tài liệu · ${docTypeLabel(h.name)}` : `${objectTypeLabel(h.type)}${h.name !== h.id ? ` · ${h.name}` : ''}`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Header() {
  const [busy, setBusy] = useState(false)
  const reset = async () => {
    if (!window.confirm('Reset demo: xoá tài liệu đã gắn, hoàn tác mọi quyết định duyệt và về màn đầu?')) return
    setBusy(true)
    try {
      await resetDemoData()
    } finally {
      setBusy(false)
      useDemo.getState().reset()
      useDemo.getState().bumpData()
    }
  }
  return (
    <header className="hdr">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
        <span style={{ width: 12, height: 12, border: '2px solid #3FB6C0' }} />
        One Thread
      </div>
      <span style={{ color: '#9AA3AF' }}>Plant 1 · Line 1 · Bơm nước MH-20</span>
      <span style={{ flex: 1 }} />
      <Search />
      <span style={{ flex: 1 }} />
      <span className="mono" style={{ color: '#FFFFFF' }}>{formatPlantTime(DEMO_NOW, 'YYYY-MM-DD HH:mm')}</span>
      <span className="demo-tag">DEMO · DỮ LIỆU MẪU</span>
      <button className="hbtn" disabled={busy} onClick={() => void reset()} title="Xoá mọi thao tác ghi của demo">Reset demo</button>
      <span style={{ color: '#C9CFD6' }}>Quality · QA engineer</span>
    </header>
  )
}
