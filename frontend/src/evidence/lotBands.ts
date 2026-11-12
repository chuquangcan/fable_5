import type { PlantEvent } from '../api/types'

export interface LotBand { from: string; to: string; label: string }

/** Runs of consecutive events on the same lot (payload.lot); a band ends where the next lot starts. */
export function lotBands(events: PlantEvent[]): LotBand[] {
  const sorted = [...events].sort((a, b) => a.event_time.localeCompare(b.event_time))
  const bands: LotBand[] = []
  for (const e of sorted) {
    const lot = typeof e.payload.lot === 'string' ? e.payload.lot : null
    if (!lot) continue
    const last = bands[bands.length - 1]
    if (last?.label === lot) last.to = e.event_time
    else {
      if (last) last.to = e.event_time
      bands.push({ from: e.event_time, to: e.event_time, label: lot })
    }
  }
  return bands
}
