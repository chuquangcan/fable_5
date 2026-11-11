import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import type { TraceGraph } from '../api/types'
import m01 from '../test/fixtures/summary_m01.json'
import m02 from '../test/fixtures/summary_m02.json'
import trace from '../test/fixtures/trace.json'
import { useDemo } from '../store/demo'
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
  expect(screen.getByText('Machine 02 · machine')).toBeInTheDocument()
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

test('fault button sets the origin; attach stays disabled; fault button hidden for aggregates', async () => {
  const { unmount } = render(<OverviewTab id="M02" />)
  await screen.findByText('Cycle TB · LOT-B')
  expect(screen.getByRole('button', { name: 'Đặt làm điểm lỗi' })).toBeEnabled()
  await userEvent.click(screen.getByRole('button', { name: 'Đặt làm điểm lỗi' }))
  expect([useDemo.getState().faultOrigin, useDemo.getState().mode]).toEqual(['M02', 'fault'])
  expect(screen.getByRole('button', { name: 'Gắn tài liệu' })).toBeDisabled()
  unmount()
  render(<OverviewTab id="AGG-LOT-B" />)
  await screen.findByText('AGG-LOT-B · aggregate')
  expect(screen.queryByRole('button', { name: 'Đặt làm điểm lỗi' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Gắn tài liệu' })).toBeInTheDocument()
})

test('docs render with status badges', async () => {
  vi.mocked(api.getSummary).mockResolvedValue({
    ...m01,
    docs: [
      { doc_id: 'D-01', page: null, type: 'coa', text: 'x', extracted_codes: [], tier: 4, status: 'confirmed', score: null },
      { doc_id: 'D-02', page: 3, type: 'coa', text: 'y', extracted_codes: [], tier: 3, status: 'pending', score: 0.78 },
      { doc_id: 'D-03', page: null, type: 'coa', text: 'z', extracted_codes: [], tier: 5, status: 'suggested', score: 0.5 },
    ],
  } as never)
  render(<OverviewTab id="M01" />)
  expect(await screen.findByText('bậc 4 · duyệt')).toBeInTheDocument()
  expect(screen.getByText('chờ duyệt · 0.78')).toBeInTheDocument()
  expect(screen.getByText('chỉ gợi ý · bậc 5')).toBeInTheDocument()
  expect(screen.getByText('D-02 · p.3')).toBeInTheDocument()
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
  expect(useDemo.getState().evidenceTab).toBe('m02')
  useDemo.getState().selectNode('PO-4410')
  expect(useDemo.getState().evidenceTab).toBe('overview')
})

test('EvidencePanel in normal mode has only the overview tab', async () => {
  useDemo.getState().focusNode('M02')
  render(<EvidencePanel trace={trace as unknown as TraceGraph} />)
  expect(screen.getByRole('button', { name: 'Tổng quan · M02' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Khoanh vùng LOT-B/ })).toBeNull()
  expect(await screen.findByText('Cycle TB · LOT-B')).toBeInTheDocument()
})
