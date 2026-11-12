import { useEffect } from 'react'
import { getShipmentSerials, search } from '../api/client'
import { Pending, useAsync } from '../evidence/useAsync'
import { useDemo } from '../store/demo'

const SERIAL = /^MH20-/

/** Serials behind the volume node (first 50) or inside one shipment; picking one opens its product tab. */
export function SerialPicker({ source, onClose }: { source: string; onClose: () => void }) {
  const openProduct = useDemo((s) => s.openProduct)
  const serials = useAsync(
    () => (source === 'VOL' ? search('MH20-').then((h) => h.map((x) => x.id).filter((id) => SERIAL.test(id)).slice(0, 50)) : getShipmentSerials(source)),
    [source],
  )
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const label = source === 'VOL' ? 'Serials produced' : `Serials in ${source}`
  return (
    <div role="dialog" aria-label={label} className="twin-pop">
      <div className="twin-pop-head">
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ flex: 1 }} />
        <button className="btn" aria-label="Close" onClick={onClose}>✕</button>
      </div>
      {serials.status !== 'ok' ? <Pending state={serials} /> : serials.data.length === 0
        ? <div className="mut" style={{ padding: 10 }}>No serials found</div>
        : (
          <div className="twin-pop-list">
            {serials.data.map((s) => (
              <button key={s} className="linkish mono" onClick={() => { openProduct(s); onClose() }}>{s}</button>
            ))}
          </div>
        )}
    </div>
  )
}
