import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import m01 from '../test/fixtures/summary_m01.json'
import m02 from '../test/fixtures/summary_m02.json'
import { threadTabId, useDemo } from '../store/demo'
import { ProductTabContext } from '../thread/ProductTabContext'
import { EvidencePanel } from './EvidencePanel'
import { OverviewTab } from './OverviewTab'

vi.mock('../api/client')

const T = threadTabId('MH20-0001')
const inTab = (id: string, tab = T) => <ProductTabContext.Provider value={tab}><OverviewTab id={id} /></ProductTabContext.Provider>

beforeEach(() => {
  useDemo.getState().reset()
  vi.mocked(api.getSummary).mockImplementation(async (id) => (id === 'M01' ? m01 : id.startsWith('AGG-') ? { ...m02, id, type: 'aggregate', name: id } : m02) as never)
})

test('M02 overview lists params with source chips', async () => {
  render(<OverviewTab id="M02" />)
  expect(await screen.findByText('Avg cycle · LOT-B')).toBeInTheDocument()
  expect(screen.getByText('Machine 02 · Machine')).toBeInTheDocument()
  expect(screen.getByText('Production')).toBeInTheDocument()
  const chip = screen.getByText('CMMS')
  expect(chip).toHaveClass('cite')
  expect(chip).toHaveAttribute('title', 'PM-0241')
  expect(screen.getByText('2026-10-20 · normal')).toBeInTheDocument()
  expect(screen.getByText('NV-118 · Shift 2')).toBeInTheDocument()
  expect(screen.getByText('42 s')).toBeInTheDocument()
})

test('node without params or docs shows empty states', async () => {
  render(<OverviewTab id="M01" />)
  expect(await screen.findByText('No parameters yet')).toBeInTheDocument()
  expect(screen.getByText(/No documents yet/)).toBeInTheDocument()
})

test('fault button sets the origin; attach button opens the dialog; both hidden for aggregates', async () => {
  useDemo.getState().openClaim('CLM-0012', 'MH20-0001')  // the fault trace needs a claim on the tab
  useDemo.getState().setMode(T, 'normal')
  const { unmount } = render(inTab('M02'))
  await screen.findByText('Avg cycle · LOT-B')
  expect(screen.getByRole('button', { name: 'Set as fault origin' })).toBeEnabled()
  await userEvent.click(screen.getByRole('button', { name: 'Set as fault origin' }))
  expect([useDemo.getState().product[T].faultOrigin, useDemo.getState().product[T].mode]).toEqual(['M02', 'fault'])
  await userEvent.click(screen.getByRole('button', { name: 'Attach document' }))
  expect(useDemo.getState().attachOpen).toBe(true)
  unmount()
  render(inTab('AGG-LOT-B'))
  await screen.findByText('AGG-LOT-B · Lot aggregate')
  expect(screen.queryByRole('button', { name: 'Set as fault origin' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Attach document' })).toBeNull()
})

test('no fault button outside a product tab, nor on a product tab without a claim', async () => {
  useDemo.getState().openClaim('CLM-0012', 'MH20-0001')
  const { unmount } = render(<OverviewTab id="M02" />)
  await screen.findByText('Avg cycle · LOT-B')
  expect(screen.queryByRole('button', { name: 'Set as fault origin' })).toBeNull()
  unmount()
  const plain = useDemo.getState().openProduct('MH20-0457')
  render(inTab('M02', plain))
  await screen.findByText('Avg cycle · LOT-B')
  expect(screen.queryByRole('button', { name: 'Set as fault origin' })).toBeNull()
})

test('"View on plant" on a thread node selects that object on the twin', async () => {
  useDemo.getState().openClaim('CLM-0012', 'MH20-0001')
  render(inTab('M02'))
  await userEvent.click(await screen.findByRole('button', { name: 'View on plant' }))
  expect([useDemo.getState().groups.main.active, useDemo.getState().twin.selected]).toEqual(['twin', 'M02'])
})

test('docs render with status badges', async () => {
  vi.mocked(api.getSummary).mockResolvedValue({
    ...m01,
    docs: [
      { doc_id: 'D-01', page: null, type: 'coa', text: 'x', extracted_codes: [], tier: 4, status: 'confirmed', score: null },
      { doc_id: 'D-02', page: 3, type: 'coa', text: 'y', extracted_codes: [], tier: 3, status: 'pending', score: 0.78 },
      { doc_id: 'D-03', page: null, type: 'coa', text: 'z', extracted_codes: [], tier: 5, status: 'suggested', score: 0.5 },
      { doc_id: 'D-04', page: null, type: 'coa', text: 'w', extracted_codes: [], tier: 4, status: 'inferred', score: 0.9 },
    ],
  } as never)
  render(<OverviewTab id="M01" />)
  expect(await screen.findByText('tier 4 · approved')).toBeInTheDocument()
  expect(screen.getAllByText(/tier 4 · approved/)).toHaveLength(1)
  const auto = screen.getByText('tier 4 · automatic 0.90')
  expect(auto).toHaveStyle({ borderStyle: 'dashed' })
  expect(screen.getByText('pending review · 0.78')).toBeInTheDocument()
  expect(screen.getByText('suggestion only · tier 5')).toBeInTheDocument()
  expect(screen.getByText('D-02 · p.3')).toBeInTheDocument()
})

test('uploaded docs carry a "new" badge and sort first; a card opens a document tab; empty state', async () => {
  vi.mocked(api.getSummary).mockResolvedValueOnce({
    ...m01,
    docs: [
      { doc_id: 'D-U01', page: null, type: 'coa', text: 'x', extracted_codes: [], tier: 4, status: 'inferred', score: 0.9 },
      { doc_id: 'D-01', page: null, type: 'coa', text: 'y', extracted_codes: [], tier: 4, status: 'confirmed', score: null },
    ],
  } as never)
  const { unmount } = render(<OverviewTab id="M01" />)
  expect(await screen.findAllByText('new')).toHaveLength(1)
  const cards = screen.getAllByTitle('View document details')
  expect(within(cards[0]).getByText('D-U01')).toBeInTheDocument()
  await userEvent.click(cards[1])
  expect(useDemo.getState().groups.main.active).toBe('doc:D-01')
  unmount()
  render(<OverviewTab id="M01" />)
  expect(await screen.findByText('No documents yet')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Attach document' }))
  expect(useDemo.getState().attachOpen).toBe(true)
})

test('status filter chips narrow the document list', async () => {
  vi.mocked(api.getSummary).mockResolvedValue({
    ...m01,
    docs: [
      { doc_id: 'D-01', page: null, type: 'coa', text: 'x', extracted_codes: [], tier: 4, status: 'confirmed', score: null },
      { doc_id: 'D-02', page: null, type: 'coa', text: 'y', extracted_codes: [], tier: 4, status: 'pending', score: 0.7 },
    ],
  } as never)
  render(<OverviewTab id="M01" />)
  await userEvent.click(await screen.findByRole('button', { name: 'Pending review 1' }))
  expect(screen.queryByText('D-01')).toBeNull()
  expect(screen.getByText('D-02')).toBeInTheDocument()
})

test('refetches when dataVersion changes', async () => {
  render(<OverviewTab id="M02" />)
  await screen.findByText('Avg cycle · LOT-B')
  expect(api.getSummary).toHaveBeenCalledTimes(1)
  useDemo.getState().bumpData()
  await vi.waitFor(() => expect(api.getSummary).toHaveBeenCalledTimes(2))
})

test('selectNode: normal mode always overview; fault mode keeps deep tabs', () => {
  useDemo.getState().openClaim('CLM-0012', 'MH20-0001')
  useDemo.getState().setMode(T, 'normal')
  useDemo.getState().selectNode(T, 'M02')
  expect([useDemo.getState().evidence[T], useDemo.getState().product[T].focusNodeId]).toEqual(['overview', 'M02'])
  useDemo.getState().setMode(T, 'fault')
  useDemo.getState().selectNode(T, 'M02')
  expect(useDemo.getState().evidence[T]).toBe('machine')
  useDemo.getState().selectNode(T, 'PO-4410')
  expect(useDemo.getState().evidence[T]).toBe('overview')
})

test('EvidencePanel offers the tabs of the node type, not a fixed set', async () => {
  useDemo.getState().setEvidence('o', 'overview')
  const { unmount } = render(<EvidencePanel nodeId="M02" owner="o" />)
  expect(await screen.findByText('Avg cycle · LOT-B')).toBeInTheDocument()
  // a machine shows its press cycle first (spec §5)
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Press cycle', 'Overview', 'Events · 1,684'])
  unmount()
  render(<EvidencePanel nodeId="M01" owner="o" />)
  expect(await screen.findByText('No parameters yet')).toBeInTheDocument()
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Overview'])
})

test('a stale deep tab falls back to the first tab of a node without it', async () => {
  useDemo.getState().setEvidence('o', 'impact')
  render(<EvidencePanel nodeId="M01" owner="o" />)
  expect(await screen.findByText('No parameters yet')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
})

test('with no sub-tab chosen yet, a machine opens on its press cycle', async () => {
  render(<EvidencePanel nodeId="M02" owner="object:M02" />)
  await vi.waitFor(() => expect(screen.getByRole('tab', { name: 'Press cycle' })).toHaveAttribute('aria-selected', 'true'))
})

test('param rows with the same label keep distinct keys', async () => {
  const err = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(api.getSummary).mockResolvedValue({
    ...m01,
    params: [
      { label: 'Shipment', value: 'SHP-1', unit: null, source: 'WMS', source_record_id: null },
      { label: 'Shipment', value: 'SHP-2', unit: null, source: 'WMS', source_record_id: null },
    ],
  } as never)
  render(<OverviewTab id="M01" />)
  expect(await screen.findByText('SHP-2')).toBeInTheDocument()
  expect(err.mock.calls.some((c) => String(c[0]).includes('same key'))).toBe(false)
  err.mockRestore()
})
