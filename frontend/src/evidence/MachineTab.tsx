import { getCompare, getEvents } from '../api/client'
import type { LotStat, PlantEvent } from '../api/types'
import { formatPlantTime } from '../lib/time'
import { CycleChart } from './CycleChart'
import { Pending, useAsync } from './useAsync'

const DAY = '2026-11-03'
const W_START = `${DAY}T12:00:00+07:00`
const W_END = `${DAY}T16:00:00+07:00`

async function load() {
  const [cycles, lotStats, maintenance, shifts, env, loaded, serial] = await Promise.all([
    getEvents('M02', W_START, W_END, 'press_cycle'),
    getCompare('M02', DAY),
    getEvents('M02', '2026-10-01T00:00:00+07:00', '2026-11-04T00:00:00+07:00', 'maintenance'),
    getEvents('M02', '2026-10-01T00:00:00+07:00', '2026-11-04T00:00:00+07:00', 'shift'),
    getEvents('LINE-1', W_START, W_END, 'env_temp'),
    getEvents('HOP-1', W_START, W_END, 'lot_loaded'),
    getEvents('MH20-0001', undefined, undefined, 'press_cycle'),
  ])
  return { cycles, lotStats, maintenance, shifts, env, loaded: loaded[0], serial: serial[0] }
}

const Cite = ({ children }: { children: string }) => <span className="cite">{children}</span>
const bad = { color: '#A61B1B', fontWeight: 600 } as const

export function MachineTab() {
  const s = useAsync(load, [])
  if (s.status !== 'ok') return <Pending state={s} />
  const { cycles, lotStats, maintenance, shifts, env, loaded, serial } = s.data
  const [before, after] = [...lotStats].sort((a: LotStat, b: LotStat) => a.first.localeCompare(b.first))
  const pm: PlantEvent | undefined = maintenance[0]
  const shift: PlantEvent | undefined = shifts[0]
  const temps = env.map((e) => Number(e.payload.temp_c)).filter((t) => !Number.isNaN(t))
  const delta = before && after ? Math.round((after.force_mean_kn / before.force_mean_kn - 1) * 100) : 0
  const cut = loaded ? formatPlantTime(loaded.event_time, 'HH:mm') : ''
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex' }}>
      <div style={{ width: 476, flex: 'none', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6, borderRight: '1px solid var(--line-faint)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Cycle time · Machine 02</span>
          <span className="mut">2026-11-03 12:00–16:00 · giờ nhà máy</span>
        </div>
        <CycleChart
          events={cycles}
          markers={[
            ...(loaded ? [{ time: loaded.event_time, label: 'nạp LOT-B vào Hopper 1', kind: 'load' as const }] : []),
            ...(serial ? [{ time: serial.event_time, label: 'MH20-0001', kind: 'serial' as const }] : []),
          ]}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Cite>PLC2 cycle log</Cite><Cite>MES MC-02</Cite>{loaded && <Cite>{`WMS ${loaded.source_record_id}`}</Cite>}
          <span className="mut" style={{ fontSize: 11 }}>mốc {cut} khớp nhờ bù lệch PLC2 +38 s</span>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <table className="g">
          <thead><tr><th>Yếu tố</th><th>Trước {cut}</th><th>Sau {cut}</th><th>Nguồn</th></tr></thead>
          <tbody>
            {before && after && (
              <>
                <tr style={{ background: 'var(--red-bg)' }}>
                  <td>Cycle time</td><td className="mono">{Math.round(before.cycle_mean_s)} s</td>
                  <td className="mono" style={bad}>{Math.round(after.cycle_mean_s)} s</td><td><Cite>PLC2</Cite></td>
                </tr>
                <tr style={{ background: 'var(--red-bg)' }}>
                  <td>Lực ép đỉnh</td><td className="mono">{before.force_mean_kn.toFixed(1)} kN</td>
                  <td className="mono" style={bad}>{after.force_mean_kn.toFixed(1)} kN · {delta >= 0 ? '+' : ''}{delta}%</td><td><Cite>PLC2</Cite></td>
                </tr>
                <tr>
                  <td>Lô ổ bi</td><td className="mono">{before.lot}</td>
                  <td className="mono" style={{ color: 'var(--amber-ink)', fontWeight: 600 }}>{after.lot}</td><td><Cite>{loaded?.source ?? 'WMS'}</Cite></td>
                </tr>
              </>
            )}
            {pm && (
              <tr>
                <td>Bảo trì</td>
                <td colSpan={2}>{pm.source_record_id} ngày {formatPlantTime(pm.event_time).slice(0, 5)} · {pm.payload.result === 'normal' ? 'bình thường' : String(pm.payload.result)}</td>
                <td><Cite>{pm.source}</Cite></td>
              </tr>
            )}
            {shift && (
              <tr>
                <td>Vận hành</td>
                <td colSpan={2}>{String(shift.payload.operator)} · {String(shift.payload.shift).toLowerCase()} · {shift.payload.changed ? 'có đổi người' : 'không đổi người'}</td>
                <td><Cite>{shift.source}</Cite></td>
              </tr>
            )}
            {temps.length > 0 && (
              <tr>
                <td>Nhiệt độ khu vực</td>
                <td colSpan={2}>{Math.round(Math.min(...temps))}–{Math.round(Math.max(...temps))} °C · {Math.max(...temps) - Math.min(...temps) < 2 ? 'ổn định' : 'dao động'}</td>
                <td><Cite>{env[0].source}</Cite></td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.45 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: 'var(--label)' }}>ĐỌC NHANH</div>
          <div>Chỉ <b style={{ fontWeight: 600 }}>lô ổ bi</b> thay đổi tại {cut}; bảo trì, người vận hành và nhiệt độ giữ nguyên → ba yếu tố này được loại trừ.</div>
        </div>
      </div>
    </div>
  )
}
