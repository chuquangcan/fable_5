import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import type { PlantEvent, PlantOverview as Overview } from '../api/types'
import { CycleChart } from '../evidence/CycleChart'
import { lotBands } from '../evidence/lotBands'
import { useDemo } from '../store/demo'
import overview from '../test/fixtures/plant_overview.json'
import { DataSources } from './DataSources'
import { PlantOverview } from './PlantOverview'

vi.mock('../api/client')

const st = () => useDemo.getState()
const kpi = (name: string) => within(screen.getByRole('group', { name })).getByTestId('kpi-value')

beforeEach(() => {
  st().reset()
  vi.mocked(api.getPlantOverview).mockResolvedValue(overview as Overview)
})

test('KPIs, the line and machine table and shipment risk', async () => {
  render(<PlantOverview />)
  expect(await screen.findByRole('group', { name: 'Open alerts' })).toBeInTheDocument()
  expect(kpi('Open alerts')).toHaveTextContent('1')
  expect(kpi('Output')).toHaveTextContent('2,108')
  expect(kpi('Cycle vs target')).toHaveTextContent('34.6 s / 30.3 s')
  expect(kpi('4M watching')).toHaveTextContent('2')
  expect(kpi('Links pending review')).toHaveTextContent('3')
  const rows = screen.getAllByRole('row').map((r) => r.getAttribute('data-id')).filter(Boolean)
  expect(rows.slice(0, 5)).toEqual(['LINE-1', 'M02', 'LINE-2', 'M01', 'M03'])
  expect(within(screen.getByRole('row', { name: /SHP-1120/ })).getByText('high')).toHaveClass('chip', 'risk-high')
  expect(api.getPlantOverview).toHaveBeenCalledWith('2026-11-03T14:05:00+07:00')
})

test('clicking a machine row goes to it', async () => {
  render(<PlantOverview />)
  await userEvent.click(await screen.findByRole('row', { name: /Machine 02/ }))
  expect(st().twin.selected).toBe('M02')
})

test('an as-of with no data shows dashes, not errors', async () => {  // Review Focus #5
  const empty = {
    ...overview,
    kpis: { ...overview.kpis, output: 0, cycle_s: null, target_s: null },
    rows: overview.rows.map((r) => ({ ...r, state: 'stopped', cycle_s: null, output: 0, lot: null, trend: [] })),
  }
  vi.mocked(api.getPlantOverview).mockResolvedValue(empty as Overview)
  const { container } = render(<PlantOverview />)
  expect(await screen.findByRole('group', { name: 'Cycle vs target' })).toBeInTheDocument()
  expect(kpi('Cycle vs target')).toHaveTextContent('—')
  const m02 = screen.getByRole('row', { name: /Machine 02/ })
  expect(within(m02).getAllByText('—').length).toBeGreaterThanOrEqual(2)
  expect(container.querySelectorAll('[data-testid="sparkline"] path')).toHaveLength(0)
})

test('data sources list each source with its department, count and delay', async () => {
  render(<DataSources />)
  const plc2 = await screen.findByRole('row', { name: /PLC2/ })
  expect(within(plc2).getByText('Production')).toBeInTheDocument()
  expect(within(plc2).getByText('1,682')).toBeInTheDocument()
  expect(within(plc2).getByText('38 s')).toBeInTheDocument()
  expect(within(screen.getByRole('row', { name: /CMMS/ })).getByText('—')).toBeInTheDocument()
})

const ev = (minute: number, lot: string): PlantEvent => ({
  event_id: `E${minute}`, type: 'press_cycle', object_ids: ['M02'], event_time: new Date(Date.UTC(2026, 10, 3, 5, minute)).toISOString(),
  time_kind: 'sensor', source: 'PLC2', source_record_id: null, payload: { cycle_s: 30, lot },
})

test('lot bands follow runs of the same lot; the chart draws bands and notice markers', () => {
  const events = [ev(0, 'LOT-A'), ev(10, 'LOT-A'), ev(20, 'LOT-A'), ev(30, 'LOT-B'), ev(40, 'LOT-B')]
  expect(lotBands(events)).toEqual([
    { from: events[0].event_time, to: events[3].event_time, label: 'LOT-A' },
    { from: events[3].event_time, to: events[4].event_time, label: 'LOT-B' },
  ])
  const { container } = render(
    <CycleChart
      events={events} markers={[]} start={events[0].event_time} end={events[4].event_time} target={30} machineName="M02"
      bands={lotBands(events)} notices={[{ time: events[3].event_time, label: '4M-0002', kind: '4m' }, { time: events[4].event_time, label: 'AL-0001', kind: 'alert' }]}
    />,
  )
  expect(container.querySelectorAll('[data-testid="lot-band"]')).toHaveLength(2)
  expect(container.querySelectorAll('[data-testid="notice-marker"]')).toHaveLength(2)
  expect(screen.getByText('LOT-B')).toBeInTheDocument()
})
