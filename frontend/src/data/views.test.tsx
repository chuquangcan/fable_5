import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import type { Claim, DocRow, PlantArea } from '../api/types'
import { PlantSidebar } from '../plant/PlantSidebar'
import { Header } from '../shell/Header'
import { MainContent } from '../shell/tabContent'
import { threadTabId, useDemo } from '../store/demo'
import { DataSidebar, DataView } from './DataView'

vi.mock('../api/client')

const row = (doc_id: string, type: string, status: DocRow['status'], other: string | null, uploaded = false): DocRow => ({
  doc_id, type, source: 'QMS', pages: [1], file_uri: null, has_file: uploaded, uploaded, effective_from: '2026-09-29T17:00:00Z',
  excerpt: `${doc_id} content`, codes: [], status,
  links: other ? [{ link_id: 1, other_id: other, relation: 'mentions', tier: 4, status: status as never, score: 0.9 }] : [],
})
const docs = [row('D-U01', 'coa', 'inferred', 'LOT-B', true), row('D-07', 'meeting_minutes', 'pending', 'LOT-B'), row('D-09', '8d_report', 'confirmed', 'CLM-0009'), row('D-99', 'upload', 'unlinked', null)]

const plant: PlantArea[] = [
  { id: 'san_xuat', label: 'Production', volume: '1,000 serial', groups: [{ type: 'machine', label: 'Machine', items: [
    { id: 'M02', type: 'machine', name: 'Machine 02', sub: 'Line 1', events: 1684, docs: 0, to_review: 0 },
    { id: 'M01', type: 'machine', name: 'Machine 01', sub: 'no line assigned', events: 0, docs: 0, to_review: 0 },
  ] }] },
  { id: 'kho_nl', label: 'Raw materials warehouse', volume: null, groups: [{ type: 'lot', label: 'Component lot', items: [
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

const st = () => useDemo.getState()
const T = threadTabId('MH20-0001')

/** The active main tab's content, as the workspace renders it. */
function ActiveMain() {
  const tab = useDemo((s) => s.groups.main.tabs.find((t) => t.id === s.groups.main.active) ?? null)
  return <MainContent tab={tab} />
}

test('document store: filters by text, type and status; a row opens a document tab; a link chip navigates', async () => {
  render(<DataView target="docs" />)
  expect(await screen.findByText('4 / 4 documents')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Link status'), 'pending')
  expect(screen.getByText('1 / 4 documents')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Link status'), 'unlinked')
  expect(screen.getByText('D-99')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Link status'), '')
  await userEvent.selectOptions(screen.getByLabelText('Document type'), '8d_report')
  expect(screen.getByText('1 / 4 documents')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Document type'), '')
  await userEvent.type(screen.getByLabelText('Search documents'), 'meeting')  // matches the type label
  expect(screen.getByText('1 / 4 documents')).toBeInTheDocument()
  await userEvent.click(screen.getByText('D-07 content'))
  expect(st().groups.main.active).toBe('doc:D-07')
  await userEvent.click(screen.getByRole('button', { name: 'LOT-B' }))
  expect(st().groups.bottom.active).toBe('object:LOT-B')
})

test('data sidebar opens tables and the document store in main, the review queue in the dock', async () => {
  render(<><DataSidebar /><ActiveMain /></>)
  await userEvent.click(await screen.findByRole('button', { name: /links\s*4,069/ }))
  expect(st().groups.main.tabs.find((t) => t.id === 'table:links')).toMatchObject({ kind: 'table', target: 'links' })
  expect(st().groups.main.active).toBe('table:links')
  expect(screen.getByRole('button', { name: /links\s*4,069/ })).toHaveAttribute('aria-current', 'true')
  expect(await screen.findByText('1–50 / 120')).toBeInTheDocument()
  expect(screen.getByText('{"stage":"kho"}')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(await screen.findByText('51–100 / 120')).toBeInTheDocument()
  expect(api.getTable).toHaveBeenLastCalledWith('links', '', 50, 50)
  await userEvent.type(screen.getByLabelText('Filter table links'), 'D-07{Enter}')
  expect(api.getTable).toHaveBeenLastCalledWith('links', 'D-07', 50, 0)
  await userEvent.click(screen.getByRole('button', { name: 'Document repository' }))
  expect(st().groups.main.active).toBe('table:docs')
  expect(await screen.findByText('4 / 4 documents')).toBeInTheDocument()
  st().closeTab('bottom', 'review')
  await userEvent.click(screen.getByRole('button', { name: 'Review queue' }))
  expect(st().groups.bottom.active).toBe('review')
})

test('plant sidebar: areas, volume counts and review badges; picking an asset selects it on the twin', async () => {
  render(<PlantSidebar />)
  expect(await screen.findByText('1,000 serial')).toBeInTheDocument()
  const lot = screen.getByRole('button', { name: /LOT-B/ })
  expect(within(lot).getByTitle('Links pending review')).toHaveTextContent('1')
  await userEvent.click(screen.getByRole('button', { name: /Machine 01/ }))
  expect([st().twin.selected, st().groups.bottom.active]).toEqual(['M01', 'object:M01'])
  expect(screen.getByRole('button', { name: /Machine 01/ })).toHaveAttribute('aria-current', 'true')
})

test('goTo keeps a node on the open thread there, sends others to the dock, documents to main', async () => {
  st().openClaim('CLM-0012', 'MH20-0001')
  st().setThreadIds(T, ['MH20-0001', 'M02'])
  await st().goTo('M02')
  expect([st().groups.main.active, st().product[T].focusNodeId]).toEqual([T, 'M02'])
  await st().goTo('M03')
  expect(st().groups.bottom.active).toBe('object:M03')
  await st().goTo('D-12')
  expect(st().groups.main.active).toBe('doc:D-12')
})

test('header search: a hit for a document opens it, a traceable claim opens its thread', async () => {
  vi.mocked(api.search).mockResolvedValue([
    { id: 'D-12', kind: 'document', type: 'document', name: 'drawing' },
    { id: 'CLM-0012', kind: 'object', type: 'claim', name: 'CLM-0012' },
  ])
  vi.mocked(api.getClaim).mockResolvedValue({ id: 'CLM-0012', serial: 'MH20-0001', traceable: true } as Claim)
  render(<Header />)
  const box = screen.getByRole('combobox')
  await userEvent.type(box, 'D-1')
  await userEvent.click(await screen.findByText('Document · Drawing'))
  expect(st().groups.main.active).toBe('doc:D-12')
  await userEvent.type(box, 'CLM')
  await screen.findByText('Claim')
  await userEvent.keyboard('{ArrowDown}{Enter}')
  await waitFor(() => expect(st().groups.main.active).toBe(T))
  expect(st().product[T].claimId).toBe('CLM-0012')
})
