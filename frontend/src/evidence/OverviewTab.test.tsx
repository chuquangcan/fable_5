import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import m01 from '../test/fixtures/summary_m01.json'
import m02 from '../test/fixtures/summary_m02.json'
import pm0241 from '../test/fixtures/summary_pm0241.json'
import { useDemo } from '../store/demo'
import { CiteChip } from '../agent/AgentPanel'
import { EvidencePanel } from './EvidencePanel'
import { OverviewTab } from './OverviewTab'

vi.mock('../api/client')

beforeEach(() => {
  useDemo.getState().reset()
  vi.mocked(api.getSummary).mockImplementation(async (id) => (id === 'M01' ? m01 : id.startsWith('AGG-') ? { ...m02, id, type: 'aggregate', name: id } : m02) as never)
})

test('M02 overview lists params with source chips', async () => {
  render(<OverviewTab id="M02" />)
  expect(await screen.findByText('Cycle TB · LOT-B')).toBeInTheDocument()
  expect(screen.getByText('Machine 02 · Máy')).toBeInTheDocument()
  expect(screen.getByText('Sản xuất')).toBeInTheDocument()
  const chip = screen.getByText('CMMS')
  expect(chip).toHaveClass('cite')
  expect(chip).toHaveAttribute('title', 'PM-0241')
  expect(screen.getByText('2026-10-20 · normal')).toBeInTheDocument()
  expect(screen.getByText('NV-118 · Ca 2')).toBeInTheDocument()
  expect(screen.getByText('42 s')).toBeInTheDocument()
})

test('node without params or docs shows empty states', async () => {
  render(<OverviewTab id="M01" />)
  expect(await screen.findByText('Chưa có thông số')).toBeInTheDocument()
  expect(screen.getByText(/Chưa có tài liệu/)).toBeInTheDocument()
})

test('fault button sets the origin; attach button opens the dialog; both hidden for aggregates', async () => {
  useDemo.setState({ claimId: 'CLM-0012', view: 'product' })  // the fault trace needs an open claim
  const { unmount } = render(<OverviewTab id="M02" />)
  await screen.findByText('Cycle TB · LOT-B')
  expect(screen.getByRole('button', { name: 'Đặt làm điểm lỗi' })).toBeEnabled()
  await userEvent.click(screen.getByRole('button', { name: 'Đặt làm điểm lỗi' }))
  expect([useDemo.getState().faultOrigin, useDemo.getState().mode]).toEqual(['M02', 'fault'])
  await userEvent.click(screen.getByRole('button', { name: 'Gắn tài liệu' }))
  expect(useDemo.getState().attachOpen).toBe(true)
  unmount()
  render(<OverviewTab id="AGG-LOT-B" />)
  await screen.findByText('AGG-LOT-B · Gộp lô')
  expect(screen.queryByRole('button', { name: 'Đặt làm điểm lỗi' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Gắn tài liệu' })).toBeNull()
})

test('no fault button outside an open claim (plant view)', async () => {
  useDemo.setState({ claimId: 'CLM-0012', view: 'plant' })
  render(<OverviewTab id="M02" />)
  await screen.findByText('Cycle TB · LOT-B')
  expect(screen.queryByRole('button', { name: 'Đặt làm điểm lỗi' })).toBeNull()
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
  expect(await screen.findByText('bậc 4 · duyệt')).toBeInTheDocument()
  expect(screen.getAllByText(/bậc 4 · duyệt/)).toHaveLength(1)
  const auto = screen.getByText('bậc 4 · tự động 0.90')
  expect(auto).toHaveStyle({ borderStyle: 'dashed' })
  expect(screen.getByText('chờ duyệt · 0.78')).toBeInTheDocument()
  expect(screen.getByText('chỉ gợi ý · bậc 5')).toBeInTheDocument()
  expect(screen.getByText('D-02 · p.3')).toBeInTheDocument()
})

test('uploaded docs carry a "mới" badge and sort first; a card opens the drawer; empty state', async () => {
  vi.mocked(api.getSummary).mockResolvedValueOnce({
    ...m01,
    docs: [
      { doc_id: 'D-U01', page: null, type: 'coa', text: 'x', extracted_codes: [], tier: 4, status: 'inferred', score: 0.9 },
      { doc_id: 'D-01', page: null, type: 'coa', text: 'y', extracted_codes: [], tier: 4, status: 'confirmed', score: null },
    ],
  } as never)
  const { unmount } = render(<OverviewTab id="M01" />)
  expect(await screen.findAllByText('mới')).toHaveLength(1)
  const cards = screen.getAllByTitle('Xem chi tiết tài liệu')
  expect(within(cards[0]).getByText('D-U01')).toBeInTheDocument()
  await userEvent.click(cards[1])
  expect(useDemo.getState().docId).toBe('D-01')
  unmount()
  render(<OverviewTab id="M01" />)
  expect(await screen.findByText('Chưa có tài liệu')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Gắn tài liệu' }))
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
  await userEvent.click(await screen.findByRole('button', { name: 'Chờ duyệt 1' }))
  expect(screen.queryByText('D-01')).toBeNull()
  expect(screen.getByText('D-02')).toBeInTheDocument()
})

test('refetches when dataVersion changes', async () => {
  render(<OverviewTab id="M02" />)
  await screen.findByText('Cycle TB · LOT-B')
  expect(api.getSummary).toHaveBeenCalledTimes(1)
  useDemo.getState().bumpData()
  await vi.waitFor(() => expect(api.getSummary).toHaveBeenCalledTimes(2))
})

test('selectNode: normal mode always overview; fault mode keeps deep tabs', () => {
  useDemo.setState({ mode: 'normal' })
  useDemo.getState().selectNode('M02')
  expect(useDemo.getState().evidenceTab).toBe('overview')
  expect(useDemo.getState().focusNodeId).toBe('M02')
  useDemo.setState({ mode: 'fault' })
  useDemo.getState().selectNode('M02')
  expect(useDemo.getState().evidenceTab).toBe('machine')
  useDemo.getState().selectNode('PO-4410')
  expect(useDemo.getState().evidenceTab).toBe('overview')
})

test('EvidencePanel offers the tabs of the node type, not a fixed set', async () => {
  const { unmount } = render(<EvidencePanel nodeId="M02" />)
  expect(await screen.findByText('Cycle TB · LOT-B')).toBeInTheDocument()
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Tổng quan', 'Sự kiện · 1,684', 'Chu kỳ ép'])
  unmount()
  render(<EvidencePanel nodeId="M01" />)
  expect(await screen.findByText('Chưa có thông số')).toBeInTheDocument()
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Tổng quan'])
})

test('a stale deep tab falls back to the overview on a node without it', async () => {
  useDemo.getState().setEvidence('impact')
  render(<EvidencePanel nodeId="M02" />)
  expect(await screen.findByText('Cycle TB · LOT-B')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Tổng quan' })).toHaveAttribute('aria-selected', 'true')
})

function FocusedPanel() {
  const id = useDemo((s) => s.focusNodeId) ?? 'MH20-0001'
  return <EvidencePanel nodeId={id} />
}

test('a cite to an event record shows its summary, not the error panel', async () => {
  vi.mocked(api.getSummary).mockImplementation(async (id) => {
    if (id === 'PM-0241') return pm0241 as never
    if (id === 'GHOST-1') throw new Error('404 object GHOST-1 not found')
    return m02 as never
  })
  render(<><CiteChip label="PM-0241" target_id="PM-0241" /><CiteChip label="GHOST-1" target_id="GHOST-1" /><FocusedPanel /></>)
  await userEvent.click(screen.getByRole('button', { name: 'PM-0241' }))
  expect(await screen.findByText('maintenance · 2026-10-20 09:00 · Sự kiện')).toBeInTheDocument()
  expect(screen.getByText('normal')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Đặt làm điểm lỗi' })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'GHOST-1' }))
  expect(await screen.findByText('Không có tổng hợp cho GHOST-1')).toBeInTheDocument()
  expect(screen.queryByText(/Không tải được dữ liệu/)).toBeNull()
})

test('param rows with the same label keep distinct keys', async () => {
  const err = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(api.getSummary).mockResolvedValue({
    ...m01,
    params: [
      { label: 'Lô xuất', value: 'SHP-1', unit: null, source: 'WMS', source_record_id: null },
      { label: 'Lô xuất', value: 'SHP-2', unit: null, source: 'WMS', source_record_id: null },
    ],
  } as never)
  render(<OverviewTab id="M01" />)
  expect(await screen.findByText('SHP-2')).toBeInTheDocument()
  expect(err.mock.calls.some((c) => String(c[0]).includes('same key'))).toBe(false)
  err.mockRestore()
})
