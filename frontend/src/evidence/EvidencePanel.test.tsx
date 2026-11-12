import { act, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import type { Claim, PlantEvent } from '../api/types'
import compare from '../test/fixtures/compare.json'
import docsClm9 from '../test/fixtures/docs_clm0009.json'
import docsLotB from '../test/fixtures/docs_lotb.json'
import hopLoaded from '../test/fixtures/hop1_lot_loaded.json'
import impact from '../test/fixtures/impact.json'
import env from '../test/fixtures/line1_env.json'
import lotCompare from '../test/fixtures/lotb_compare.json'
import cycles from '../test/fixtures/m02_cycles.json'
import maintenance from '../test/fixtures/m02_maintenance.json'
import shift from '../test/fixtures/m02_shift.json'
import m02Window from '../test/fixtures/m02_window.json'
import serialEvents from '../test/fixtures/serial_events.json'
import summaryM02 from '../test/fixtures/summary_m02.json'
import { type EvidenceTab, useDemo } from '../store/demo'
import { EvidencePanel } from './EvidencePanel'

vi.mock('../api/client')

const events: Record<string, Record<string, unknown>> = {
  M02: { press_cycle: cycles, maintenance, shift },
  'LINE-1': { env_temp: env },
  'HOP-1': { lot_loaded: hopLoaded },
  'MH20-0001': { press_cycle: serialEvents.filter((e) => e.type === 'press_cycle') },
}

beforeEach(() => {
  useDemo.getState().reset()
  useDemo.setState({ mode: 'fault' })
  vi.mocked(api.getEvents).mockImplementation(async (id, _s, _e, type) => (events[id]?.[type ?? ''] ?? []) as PlantEvent[])
  vi.mocked(api.getCompare).mockResolvedValue(compare as never)
  vi.mocked(api.getMachineWindow).mockResolvedValue(m02Window as never)
  vi.mocked(api.getLotCompare).mockResolvedValue(lotCompare as never)
  vi.mocked(api.getClaims).mockResolvedValue([{ id: 'CLM-0012', customer_id: 'CUS-C3' } as Claim])
  vi.mocked(api.getDocs).mockImplementation(async (id) => (id === 'CLM-0009' ? docsClm9 : docsLotB) as never)
  vi.mocked(api.getImpact).mockResolvedValue(impact as never)
  vi.mocked(api.getSummary).mockImplementation(async (id) => (id === 'M02' ? summaryM02
    : { ...summaryM02, id, type: 'lot', name: id, params: [], counts: { links: 3, events: 2 } }) as never)
})

const NODE: Partial<Record<EvidenceTab, string>> = { machine: 'M02', lot: 'LOT-B', impact: 'LOT-B' }
const show = (tab: EvidenceTab) => {
  useDemo.getState().setEvidence(tab)
  render(<EvidencePanel nodeId={NODE[tab] ?? 'M02'} />)
}

test('machine tab shows cycle jump, force delta and exclusions', async () => {
  show('machine')
  expect(await screen.findByText('31 s')).toBeInTheDocument()
  expect(screen.getByText('42 s')).toBeInTheDocument()
  expect(screen.getByText(/\+6%/)).toBeInTheDocument()
  expect(screen.getByText(/PM-0241/)).toBeInTheDocument()
  expect(screen.getByText(/NV-118/)).toBeInTheDocument()
  expect(screen.getByRole('img', { name: /Cycle time Machine 02/ })).toBeInTheDocument()
})

test('lot tab shows IQC, similar claim and doc badges', async () => {
  show('lot')
  expect(await screen.findByText('0.92')).toBeInTheDocument()
  expect(screen.getByText('1.45')).toBeInTheDocument()
  expect(screen.getAllByText(/CLM-0009/).length).toBeGreaterThan(0)
  expect(screen.getByText('chờ duyệt · 0.78')).toBeInTheDocument()
  expect(screen.getByText('chỉ gợi ý · bậc 5')).toBeInTheDocument()
  expect(screen.getAllByText('bậc 4 · duyệt')).toHaveLength(2)
})

test('lot tab refetches when dataVersion changes', async () => {
  show('lot')
  await screen.findByText('0.92')
  expect(api.getDocs).toHaveBeenCalledTimes(2)
  act(() => useDemo.getState().bumpData())
  await vi.waitFor(() => expect(api.getDocs).toHaveBeenCalledTimes(4))
})

test('impact tab shows blast radius', async () => {
  show('impact')
  expect(await screen.findByText('1,000')).toBeInTheDocument()
  expect(screen.getByText('42')).toBeInTheDocument()
  expect(screen.getByText('2 lô · 640')).toBeInTheDocument()
  expect(screen.getByText('1 lô · 360')).toBeInTheDocument()
  expect(screen.getByText('SHP-1115')).toBeInTheDocument()
})

test('tab strip switches the evidence tab; a lot offers IQC and impact', async () => {
  show('lot')
  await screen.findByText('0.92')
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Tổng quan', 'Sự kiện · 2', 'IQC · so sánh lô', 'Khoanh vùng'])
  act(() => screen.getByRole('tab', { name: 'Khoanh vùng' }).click())
  expect(useDemo.getState().evidenceTab).toBe('impact')
  expect(await screen.findByText('1,000')).toBeInTheDocument()
})

test('machine tab derives the window, the lot change and what is ruled out; marks the open serial', async () => {
  useDemo.setState({ threadRoot: 'MH20-0001' })
  show('machine')
  expect(await screen.findByText('2026-11-03 12:00–16:00 · giờ nhà máy')).toBeInTheDocument()
  expect(screen.getByText('Lô đổi từ LOT-A sang LOT-B tại 13:52; bảo trì, người vận hành, nhiệt độ giữ nguyên → 3 yếu tố này được loại trừ.')).toBeInTheDocument()
  expect(screen.getByText('mốc 13:52 khớp nhờ bù lệch PLC2 +38 s')).toBeInTheDocument()
  expect(screen.getByText('14:05 MH20-0001')).toBeInTheDocument()
})

test('a machine without press cycles says so instead of showing story numbers', async () => {
  vi.mocked(api.getMachineWindow).mockResolvedValue({ ...m02Window, machine: 'M03', name: 'Machine 03', day: null, start: null, end: null, change: null } as never)
  useDemo.getState().setEvidence('machine')
  render(<EvidencePanel nodeId="M02" />)
  expect(await screen.findByText('Machine 03 chưa có dữ liệu chu kỳ ép.')).toBeInTheDocument()
})

test('lot tab cites the spec document from the data', async () => {
  show('lot')
  expect(await screen.findByText('spec Cpk ≥ 1.33 theo D-12 p.7')).toBeInTheDocument()
  expect(api.getLotCompare).toHaveBeenCalledWith('LOT-B')
})
