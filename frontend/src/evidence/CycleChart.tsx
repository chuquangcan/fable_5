import type { PlantEvent } from '../api/types'
import { formatPlantTime } from '../lib/time'

export interface ChartMarker { time: string; label: string; kind: 'load' | 'serial' }

const START = Date.parse('2026-11-03T12:00:00+07:00')
const SPAN_MIN = 240
const X0 = 36, X1 = 446, Y_TOP = 16, Y_BOT = 176
const V_MIN = 25, V_MAX = 45, TARGET = 30
const WINDOW_MIN = 8

const xOf = (min: number) => X0 + (min / SPAN_MIN) * (X1 - X0)
const yOf = (v: number) => Y_BOT - ((v - V_MIN) / (V_MAX - V_MIN)) * (Y_BOT - Y_TOP)
const minutes = (iso: string) => (Date.parse(iso) - START) / 60_000

/** Mean cycle_s per 8-minute window → polyline points. */
export function downsample(events: PlantEvent[]): [number, number][] {
  const buckets = new Map<number, number[]>()
  for (const e of events) {
    const v = e.payload.cycle_s
    if (typeof v !== 'number') continue
    const b = Math.floor(minutes(e.event_time) / WINDOW_MIN)
    if (b < 0 || b * WINDOW_MIN > SPAN_MIN) continue
    ;(buckets.get(b) ?? buckets.set(b, []).get(b)!).push(v)
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([b, vs]) => [(b + 0.5) * WINDOW_MIN, vs.reduce((s, v) => s + v, 0) / vs.length])
}

export function CycleChart({ events, markers }: { events: PlantEvent[]; markers: ChartMarker[] }) {
  const pts = downsample(events).map(([m, v]) => `${xOf(m).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')
  const load = markers.find((m) => m.kind === 'load')
  const serial = markers.find((m) => m.kind === 'serial')
  const mono = 'IBM Plex Mono, monospace'
  const sans = 'IBM Plex Sans, sans-serif'
  return (
    <svg width="448" height="210" role="img" aria-label="Cycle time Machine 02 tăng từ 31 giây lên 42 giây sau khi nạp LOT-B lúc 13:52">
      <g stroke="#E3E5E8">
        {[16, 56, 96, 136, 176].map((y) => <line key={y} x1={X0} y1={y} x2={X1} y2={y} />)}
      </g>
      <g fontFamily={mono} fontSize="10" fill="#5F6670">
        {[45, 40, 35, 30, 25].map((v) => <text key={v} x="4" y={yOf(v) + 4}>{v} s</text>)}
        {[[0, '12:00'], [60, '13:00'], [120, '14:00'], [180, '15:00'], [240, '16:00']].map(([m, l]) => (
          <text key={l} x={Number(m) === 240 ? 420 : xOf(Number(m)) - 6} y="194">{l}</text>
        ))}
      </g>
      <line x1={X0} y1={yOf(TARGET)} x2={X1} y2={yOf(TARGET)} stroke="#5F6670" strokeDasharray="3 3" />
      <text x="400" y={yOf(TARGET) - 4} fontSize="10" fill="#5F6670" fontFamily={sans}>mục tiêu {TARGET} s</text>
      {load && (
        <g>
          <rect x={xOf(minutes(load.time))} y={Y_TOP} width={X1 - xOf(minutes(load.time))} height={Y_BOT - Y_TOP} fill="#FFF4E5" opacity="0.7" />
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
