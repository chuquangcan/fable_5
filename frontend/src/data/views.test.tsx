import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import type { DocRow, PlantArea } from '../api/types'
import { PlantSidebar } from '../plant/PlantSidebar'
import { Header } from '../shell/Header'
import { useDemo } from '../store/demo'
import { DataSidebar, DataView } from './DataView'

vi.mock('../api/client')

const row = (doc_id: string, type: string, status: DocRow['status'], other: string | null, uploaded = false): DocRow => ({
  doc_id, type, source: 'QMS', pages: [1], file_uri: null, has_file: uploaded, uploaded, effective_from: '2026-09-29T17:00:00Z',
  excerpt: `${doc_id} nội dung`, codes: [], status,
  links: other ? [{ link_id: 1, other_id: other, relation: 'mentions', tier: 4, status: status as never, score: 0.9 }] : [],
})
const docs = [row('D-U01', 'coa', 'inferred', 'LOT-B', true), row('D-07', 'meeting_minutes', 'pending', 'LOT-B'), row('D-09', '8d_report', 'confirmed', 'CLM-0009'), row('D-99', 'upload', 'unlinked', null)]

const plant: PlantArea[] = [
  { id: 'san_xuat', label: 'Sản xuất', volume: '1,000 serial', groups: [{ type: 'machine', label: 'Máy', items: [
    { id: 'M02', type: 'machine', name: 'Machine 02', sub: 'Line 1', events: 1684, docs: 0, to_review: 0 },
    { id: 'M01', type: 'machine', name: 'Machine 01', sub: 'chưa gán line', events: 0, docs: 0, to_review: 0 },
  ] }] },
  { id: 'kho_nl', label: 'Kho nguyên liệu', volume: null, groups: [{ type: 'lot', label: 'Lô linh kiện', items: [
    { id: 'LOT-B', type: 'lot', name: 'LOT-B', sub: '', events: 2, docs: 2, to_review: 1 },
  ] }] },
]

beforeEach(() => {
  useDemo.getState().reset()
  vi.mocked(api.listDocuments).mockResolvedValue(docs)
  vi.mocked(api.getTables).mockResolvedValue([{ name: 'objects', rows: 1069, columns: ['object_id', 'type'] }, { name: 'links', rows: 4069, columns: ['link_id'] }])
  vi.mocked(api.getTable).mockImplementation(async (name, _q, limit = 50, offset = 0) => ({
    name, columns: ['object_id', 'attributes'], total: 120, offset, limit,
    rows: [{ object_id: `row-${offset}`, attributes: { stage: 'kho' } }],
  }))
  vi.mocked(api.getPlant).mockResolvedValue(plant)
  vi.mocked(api.getReviewQueue).mockResolvedValue({ pending: [], decided: [] })
  vi.mocked(api.search).mockResolvedValue([])
})

test('document store: filters by text, type and status; a row opens the drawer; a link chip navigates', async () => {
  useDemo.getState().setDataTab('docs')
  render(<DataView />)
  expect(await screen.findByText('4 / 4 tài liệu')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Trạng thái liên kết'), 'pending')
  expect(screen.getByText('1 / 4 tài liệu')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Trạng thái liên kết'), 'unlinked')
  expect(screen.getByText('D-99')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Trạng thái liên kết'), '')
  await userEvent.selectOptions(screen.getByLabelText('Loại tài liệu'), '8d_report')
  expect(screen.getByText('1 / 4 tài liệu')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Loại tài liệu'), '')
  await userEvent.type(screen.getByLabelText('Tìm tài liệu'), 'biên bản')  // matches the Vietnamese type label
  expect(screen.getByText('1 / 4 tài liệu')).toBeInTheDocument()
  await userEvent.click(screen.getByText('D-07 nội dung'))
  expect(useDemo.getState().docId).toBe('D-07')
  await userEvent.click(screen.getByRole('button', { name: 'LOT-B' }))
  expect(useDemo.getState().plantAsset).toBe('LOT-B')
})

test('raw tables: sidebar lists tables with counts; paging moves the offset; JSON cells are shown as text', async () => {
  render(<><DataSidebar /><DataView /></>)
  await userEvent.click(await screen.findByRole('button', { name: /links\s*4,069/ }))
  expect([useDemo.getState().dataTab, useDemo.getState().dataTable]).toEqual(['tables', 'links'])
  expect(await screen.findByText('1–50 / 120')).toBeInTheDocument()
  expect(screen.getByText('{"stage":"kho"}')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(await screen.findByText('51–100 / 120')).toBeInTheDocument()
  expect(api.getTable).toHaveBeenLastCalledWith('links', '', 50, 50)
  await userEvent.type(screen.getByLabelText('Lọc bảng links'), 'D-07{Enter}')
  expect(api.getTable).toHaveBeenLastCalledWith('links', 'D-07', 50, 0)
})

test('plant sidebar: areas, volume counts and review badges; picking an asset selects it in the plant view', async () => {
  render(<PlantSidebar />)
  expect(await screen.findByText('1,000 serial')).toBeInTheDocument()
  const lot = screen.getByRole('button', { name: /LOT-B/ })
  expect(within(lot).getByTitle('Liên kết chờ duyệt')).toHaveTextContent('1')
  await userEvent.click(screen.getByRole('button', { name: /Machine 01/ }))
  expect([useDemo.getState().view, useDemo.getState().plantAsset]).toEqual(['plant', 'M01'])
})

test('goTo keeps a node on the open thread in the product view, sends others to the plant view', () => {
  const s = useDemo.getState()
  s.openClaim('CLM-0012')
  s.setThreadIds(['MH20-0001', 'M02'])
  s.setView('data')
  useDemo.getState().goTo('M02')
  expect([useDemo.getState().view, useDemo.getState().focusNodeId]).toEqual(['product', 'M02'])
  useDemo.getState().goTo('M03')
  expect([useDemo.getState().view, useDemo.getState().plantAsset]).toEqual(['plant', 'M03'])
  useDemo.getState().goTo('D-12')
  expect(useDemo.getState().docId).toBe('D-12')
})

test('closing tabs: closing the last one closes the claim', () => {
  const s = useDemo.getState()
  s.openClaim('CLM-0012')
  s.closeTab('thread')
  expect([useDemo.getState().openTabs, useDemo.getState().activeTab]).toEqual([['claim'], 'claim'])
  useDemo.getState().closeTab('claim')
  expect(useDemo.getState().claimId).toBeNull()
})

test('header search: a hit for a document opens it, a traceable claim opens its thread', async () => {
  vi.mocked(api.search).mockResolvedValue([
    { id: 'D-12', kind: 'document', type: 'document', name: 'drawing' },
    { id: 'CLM-0012', kind: 'object', type: 'claim', name: 'CLM-0012' },
  ])
  render(<Header />)
  const box = screen.getByRole('combobox')
  await userEvent.type(box, 'D-1')
  await userEvent.click(await screen.findByText('Tài liệu · Bản vẽ'))
  expect(useDemo.getState().docId).toBe('D-12')
  await userEvent.type(box, 'CLM')
  await screen.findByText('Claim')
  await userEvent.keyboard('{ArrowDown}{Enter}')
  expect([useDemo.getState().claimId, useDemo.getState().activeTab]).toEqual(['CLM-0012', 'thread'])
})
