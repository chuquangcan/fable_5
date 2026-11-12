import type { PlantEvent } from '../api/types'
import { formatPlantTime } from '../lib/time'

export interface ChartMarker { time: string; label: string; kind: 'load' | 'serial' }

const X0 = 36, X1 = 446, Y_TOP = 16, Y_BOT = 176
const WINDOW_MIN = 8
const HOUR = 60

/** Mean cycle_s per 8-minute window (minutes since `start`) → [minute, value] points. */
export function downsample(events: PlantEvent[], start: string, spanMin: number): [number, number][] {
  const t0 = Date.parse(start)
  const buckets = new Map<number, number[]>()
  for (const e of events) {
    const v = e.payload.cycle_s
    if (typeof v !== 'number') continue
    const b = Math.floor((Date.parse(e.event_time) - t0) / 60_000 / WINDOW_MIN)
    if (b < 0 || b * WINDOW_MIN > spanMin) continue
    ;(buckets.get(b) ?? buckets.set(b, []).get(b)!).push(v)
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([b, vs]) => [(b + 0.5) * WINDOW_MIN, vs.reduce((s, v) => s + v, 0) / vs.length])
}

/** Y range in 5 s steps around the data and the target, at least 20 s tall. */
function yRange(values: number[], target: number | null): [number, number] {
  const all = target != null ? [...values, target] : values
  if (all.length === 0) return [25, 45]
  let lo = Math.max(0, Math.floor((Math.min(...all) - 2) / 5) * 5)
  let hi = Math.ceil((Math.max(...all) + 2) / 5) * 5
  while (hi - lo < 20) {
    hi += 5
    if (hi - lo < 20 && lo > 0) lo -= 5
  }
  return [lo, hi]
}

export function CycleChart({ events, markers, start, end, target, machineName }: {
  events: PlantEvent[]
  markers: ChartMarker[]
  start: string
  end: string
  target: number | null
  machineName: string
}) {
  const spanMin = (Date.parse(end) - Date.parse(start)) / 60_000
  const points = downsample(events, start, spanMin)
  const [vMin, vMax] = yRange(points.map(([, v]) => v), target)
  const xOf = (min: number) => X0 + (min / spanMin) * (X1 - X0)
  const yOf = (v: number) => Y_BOT - ((v - vMin) / (vMax - vMin)) * (Y_BOT - Y_TOP)
  const minutes = (iso: string) => (Date.parse(iso) - Date.parse(start)) / 60_000
  const pts = points.map(([m, v]) => `${xOf(m).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')
  const load = markers.find((m) => m.kind === 'load')
  const serial = markers.find((m) => m.kind === 'serial')
  const ticksY = Array.from({ length: 5 }, (_, i) => vMax - ((vMax - vMin) * i) / 4)
  const ticksX = Array.from({ length: Math.floor(spanMin / HOUR) + 1 }, (_, i) => i * HOUR)
  const mono = 'IBM Plex Mono, monospace'
  const sans = 'IBM Plex Sans, sans-serif'
  const before = load ? points.filter(([m]) => m < minutes(load.time)) : []
  const after = load ? points.filter(([m]) => m >= minutes(load.time)) : []
  const avg = (p: [number, number][]) => Math.round(p.reduce((s, [, v]) => s + v, 0) / Math.max(1, p.length))
  const label = load && before.length && after.length
    ? `${machineName} cycle time rose from ${avg(before)} s to ${avg(after)} s after ${load.label} at ${formatPlantTime(load.time, 'HH:mm')}`
    : `Cycle time ${machineName}`
  return (
    <svg width="448" height="210" role="img" aria-label={label}>
      <g stroke="#E3E5E8">
        {ticksY.map((v) => <line key={v} x1={X0} y1={yOf(v)} x2={X1} y2={yOf(v)} />)}
      </g>
      <g fontFamily={mono} fontSize="10" fill="#5F6670">
        {ticksY.map((v) => <text key={v} x="4" y={yOf(v) + 4}>{Math.round(v)} s</text>)}
        {ticksX.map((m) => {
          const l = formatPlantTime(new Date(Date.parse(start) + m * 60_000).toISOString(), 'HH:mm')
          return <text key={m} x={m === spanMin ? X1 - 26 : xOf(m) - 6} y="194">{l}</text>
        })}
      </g>
      {target != null && (
        <>
          <line x1={X0} y1={yOf(target)} x2={X1} y2={yOf(target)} stroke="#5F6670" strokeDasharray="3 3" />
          <text x="400" y={yOf(target) - 4} fontSize="10" fill="#5F6670" fontFamily={sans}>target {target} s</text>
        </>
      )}
      {load && (
        <g>
          <rect x={xOf(minutes(load.time))} y={Y_TOP} width={Math.max(0, X1 - xOf(minutes(load.time)))} height={Y_BOT - Y_TOP} fill="#FFF4E5" opacity="0.7" />
          <line x1={xOf(minutes(load.time))} y1="10" x2={xOf(minutes(load.time))} y2={Y_BOT} stroke="#B45309" strokeWidth="1.5" />
          <text x={xOf(minutes(load.time)) + 4} y="26" fontSize="10" fill="#7A4300" fontFamily={sans}>
            {formatPlantTime(load.time, 'HH:mm')} {load.label}
          </text>
        </g>
      )}
      {serial && (
        <g>
          <line x1={xOf(minutes(serial.time))} y1="36" x2={xOf(minutes(serial.time))} y2={Y_BOT} stroke="#1C2026" strokeDasharray="2 2" />
          <text x={xOf(minutes(serial.time)) + 4} y="172" fontSize="10" fill="#1B1F24" fontFamily={mono}>
            {formatPlantTime(serial.time, 'HH:mm')} {serial.label}
          </text>
        </g>
      )}
      <polyline points={pts} fill="none" stroke="#0E7C86" strokeWidth="2" />
    </svg>
  )
}
