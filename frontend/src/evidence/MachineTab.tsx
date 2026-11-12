import { getCompare, getEvents, getMachineWindow } from '../api/client'
import type { LotStat, MachineWindow, PlantEvent } from '../api/types'
import { formatPlantTime } from '../lib/time'
import { useDemo } from '../store/demo'
import { useProductTab } from '../thread/ProductTabContext'
import { useFeed } from '../feed/useFeed'
import { CycleChart, type ChartNotice } from './CycleChart'
import { lotBands } from './lotBands'
import { Pending, useAsync } from './useAsync'

const dayBounds = (day: string) => [`${day}T00:00:00+07:00`, `${day}T23:59:59+07:00`] as const

async function load(id: string, serial: string | null) {
  const win = await getMachineWindow(id)
  if (!win.day || !win.start || !win.end) return { win, data: null }
  const [d0, d1] = dayBounds(win.day)
  const [cycles, lotStats, maintenance, shifts, env, serialEvents] = await Promise.all([
    getEvents(id, win.start, win.end, 'press_cycle'),
    getCompare(id, win.day),
    getEvents(id, undefined, win.end, 'maintenance'),
    getEvents(id, d0, d1, 'shift'),
    win.line ? getEvents(win.line, win.start, win.end, 'env_temp') : Promise.resolve([]),
    serial ? getEvents(serial, undefined, undefined, 'press_cycle') : Promise.resolve([]),
  ])
  // the open thread's serial is marked only if it was pressed on this machine
  const pressed = serialEvents.find((e) => e.object_ids.includes(id))
  return { win, data: { cycles, lotStats, maintenance, shifts, env, serial: pressed ? { id: serial!, at: pressed.event_time } : null } }
}

const Cite = ({ children }: { children: string }) => <span className="cite">{children}</span>
const bad = { color: '#A61B1B', fontWeight: 600 } as const

function beforeAfter(win: MachineWindow, stats: LotStat[]): [LotStat | undefined, LotStat | undefined] {
  const sorted = [...stats].sort((a, b) => a.first.localeCompare(b.first))
  if (!win.change) return [undefined, undefined]
  const after = sorted.find((s) => s.lot === win.change!.lot)
  const before = sorted.filter((s) => s.lot !== win.change!.lot && s.first < (after?.first ?? '~')).pop()
  return [before, after]
}

/** Cycle time of any machine around its lot change (window from /api/machines/{id}/cycle-window). */
export function MachineTab({ machineId }: { machineId: string }) {
  const tabId = useProductTab()
  const root = useDemo((s) => (tabId ? s.product[tabId]?.root ?? null : null))
  const s = useAsync(() => load(machineId, root), [machineId, root])
  const feed = useFeed()
  if (s.status !== 'ok') return <Pending state={s} />
  const { win, data } = s.data
  if (!data) return <div className="mut" style={{ padding: 14 }}>{`${win.name} has no press cycle data yet.`}</div>
  const { cycles, lotStats, maintenance, shifts, env, serial } = data
  const [before, after] = beforeAfter(win, lotStats)
  const pm: PlantEvent | undefined = maintenance[maintenance.length - 1]
  const shift: PlantEvent | undefined = shifts[shifts.length - 1]
  const temps = env.map((e) => Number(e.payload.temp_c)).filter((t) => !Number.isNaN(t))
  const delta = before && after ? Math.round((after.force_mean_kn / before.force_mean_kn - 1) * 100) : 0
  const cut = win.change ? formatPlantTime(win.change.time, 'HH:mm') : ''
  const pmInWindow = !!pm && pm.event_time >= win.start! && pm.event_time <= win.end!
  const shiftChanged = !!shift?.payload.changed
  const tempStable = temps.length > 0 && Math.max(...temps) - Math.min(...temps) < 2
  const ruledOut = [!pmInWindow && pm && 'maintenance', shift && !shiftChanged && 'operator', tempStable && 'temperature'].filter(Boolean) as string[]
  // alerts and 4M changes about this machine inside the charted window
  const notices: ChartNotice[] = feed.status !== 'ok' ? [] : feed.data
    .filter((i) => (i.kind === 'alert' || i.kind === '4m') && i.objects.includes(machineId)
      && Date.parse(i.at) >= Date.parse(win.start!) && Date.parse(i.at) <= Date.parse(win.end!))
    .map((i) => ({ time: i.at, label: i.id, kind: i.kind as ChartNotice['kind'] }))
  const range = `${win.day} ${formatPlantTime(win.start!, 'HH:mm')}–${formatPlantTime(win.end!, 'HH:mm')}`
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex' }}>
      <div style={{ width: 476, flex: 'none', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6, borderRight: '1px solid var(--line-faint)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>{`Cycle time · ${win.name}`}</span>
          <span className="mut">{`${range} · plant time`}</span>
        </div>
        <CycleChart
          events={cycles} start={win.start!} end={win.end!} target={win.target_s} machineName={win.name}
          bands={lotBands(cycles)} notices={notices}
          markers={[
            ...(win.change ? [{ time: win.change.time, label: `${win.change.lot} loaded into ${win.change.hopper.replace('HOP-', 'Hopper ')}`, kind: 'load' as const }] : []),
            ...(serial ? [{ time: serial.at, label: serial.id, kind: 'serial' as const }] : []),
          ]}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {win.cycle_source && <Cite>{`${win.cycle_source} cycle log`}</Cite>}
          {win.change && <Cite>{`${win.change.source} ${win.change.source_record_id ?? ''}`.trim()}</Cite>}
          {win.change && win.offset_s != null && (
            <span className="mut" style={{ fontSize: 11 }}>{`the ${cut} mark matches thanks to the ${win.cycle_source} clock offset ${win.offset_s >= 0 ? '+' : ''}${win.offset_s} s`}</span>
          )}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <table className="g">
          <thead><tr><th>Factor</th><th>{cut ? `Before ${cut}` : 'Lot'}</th><th>{cut ? `After ${cut}` : ''}</th><th>Source</th></tr></thead>
          <tbody>
            {before && after && (
              <>
                <tr style={{ background: 'var(--red-bg)' }}>
                  <td>Cycle time</td><td className="mono">{Math.round(before.cycle_mean_s)} s</td>
                  <td className="mono" style={bad}>{Math.round(after.cycle_mean_s)} s</td><td><Cite>{win.cycle_source ?? 'PLC'}</Cite></td>
                </tr>
                <tr style={{ background: 'var(--red-bg)' }}>
                  <td>Peak press force</td><td className="mono">{before.force_mean_kn.toFixed(1)} kN</td>
                  <td className="mono" style={bad}>{after.force_mean_kn.toFixed(1)} kN · {delta >= 0 ? '+' : ''}{delta}%</td><td><Cite>{win.cycle_source ?? 'PLC'}</Cite></td>
                </tr>
                <tr>
                  <td>Component lot</td><td className="mono">{before.lot}</td>
                  <td className="mono" style={{ color: 'var(--amber-ink)', fontWeight: 600 }}>{after.lot}</td><td><Cite>{win.change?.source ?? 'WMS'}</Cite></td>
                </tr>
              </>
            )}
            {!(before && after) && lotStats.map((st) => (
              <tr key={st.lot}>
                <td>{`Lot ${st.lot}`}</td>
                <td className="mono" colSpan={2}>{`${Math.round(st.cycle_mean_s)} s · ${st.force_mean_kn.toFixed(1)} kN · ${st.n} cycles`}</td>
                <td><Cite>{win.cycle_source ?? 'PLC'}</Cite></td>
              </tr>
            ))}
            {pm && (
              <tr>
                <td>Maintenance</td>
                <td colSpan={2}>{pm.source_record_id} on {formatPlantTime(pm.event_time).slice(0, 5)} · {pm.payload.result === 'normal' ? 'normal' : String(pm.payload.result)}</td>
                <td><Cite>{pm.source}</Cite></td>
              </tr>
            )}
            {shift && (
              <tr>
                <td>Operator</td>
                <td colSpan={2}>{String(shift.payload.operator)} · {String(shift.payload.shift).toLowerCase()} · {shiftChanged ? 'operator changed' : 'operator unchanged'}</td>
                <td><Cite>{shift.source}</Cite></td>
              </tr>
            )}
            {temps.length > 0 && (
              <tr>
                <td>Area temperature</td>
                <td colSpan={2}>{Math.round(Math.min(...temps))}–{Math.round(Math.max(...temps))} °C · {tempStable ? 'stable' : 'fluctuating'}</td>
                <td><Cite>{env[0].source}</Cite></td>
              </tr>
            )}
          </tbody>
        </table>
        {win.change && before && after && (
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.45 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: 'var(--label)' }}>QUICK READ</div>
            <div>
              {`Lot changed from ${before.lot} to ${after.lot} at ${cut}`}
              {ruledOut.length > 0 ? `; ${ruledOut.join(', ')} unchanged → ${ruledOut.length} factors ruled out.` : '.'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
