import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import type { DocDetail } from '../api/types'
import { useDemo } from '../store/demo'
import { DocDrawer } from './DocDrawer'

vi.mock('../api/client')

const link = {
  link_id: 17, from_id: 'D-07', from_name: 'meeting_minutes p.1', from_type: 'document', to_id: 'LOT-B', to_name: 'LOT-B',
  to_type: 'lot', relation: 'mentions', tier: 4, status: 'pending', score: 0.78, method: 'rule', reason: 'nhắc "lô B"', doc_id: 'D-07',
} as const

const doc = (over: Partial<DocDetail> = {}): DocDetail => ({
  doc_id: 'D-07', type: 'meeting_minutes', source: 'Meeting', pages: [1], file_uri: 'files/D-07.pdf', has_file: false, uploaded: false,
  effective_from: '2026-10-28T17:00:00Z', excerpt: 'Biên bản họp 29/10', codes: [], status: 'pending',
  links: [{ link_id: 17, other_id: 'LOT-B', relation: 'mentions', tier: 4, status: 'pending', score: 0.78 }],
  chunks: [{ chunk_id: 'D-07-p1-c1', page: 1, text: 'Biên bản họp 29/10: lô B hơi rơ, theo dõi.', extracted_codes: [] }],
  review_links: [{ ...link }], history: [], ...over,
})

beforeEach(() => {
  useDemo.getState().reset()
  vi.mocked(api.getDocument).mockResolvedValue(doc())
  vi.mocked(api.documentFileUrl).mockImplementation((id) => `/api/documents/${id}/file`)
  vi.mocked(api.reviewLink).mockResolvedValue({} as never)
})

test('closed by default; shows metadata, full text and the link to review', async () => {
  const { container, unmount } = render(<DocDrawer />)
  expect(container).toBeEmptyDOMElement()
  unmount()
  useDemo.getState().openDoc('D-07')
  render(<DocDrawer />)
  expect(await screen.findByText('Biên bản họp 29/10: lô B hơi rơ, theo dõi.')).toBeInTheDocument()
  expect(screen.getByText('Biên bản họp')).toBeInTheDocument()
  expect(screen.getByText('1 cần duyệt')).toBeInTheDocument()
  expect(screen.getByText(/bản gốc nằm ở hệ thống Meeting/)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Mở bản gốc/ })).toBeNull()
  expect(screen.getByText('Quy tắc — nhắc "lô B"')).toBeInTheDocument()
})

test('approve sends the decision with the note and refetches everything', async () => {
  useDemo.getState().openDoc('D-07')
  render(<DocDrawer />)
  await userEvent.type(await screen.findByLabelText('Ghi chú duyệt D-07 → LOT-B'), 'đã đọc')
  const before = useDemo.getState().dataVersion
  await userEvent.click(screen.getByRole('button', { name: 'Duyệt D-07 → LOT-B' }))
  expect(api.reviewLink).toHaveBeenCalledWith(17, 'approve', 'đã đọc')
  expect(useDemo.getState().dataVersion).toBe(before + 1)
})

test('a confirmed link has no review buttons; an uploaded file can be opened; history is listed', async () => {
  vi.mocked(api.getDocument).mockResolvedValue(doc({
    doc_id: 'D-U01', uploaded: true, has_file: true, status: 'confirmed', review_links: [{ ...link, from_id: 'D-U01', doc_id: 'D-U01', status: 'confirmed' }],
    history: [{ review_id: 1, link_id: 17, decision: 'approve', from_status: 'pending', reviewer: 'QA engineer (demo)', note: 'ok',
      reviewed_at: '2027-02-12T02:00:00Z', from_id: 'D-U01', to_id: 'LOT-B', relation: 'mentions' }],
  }))
  useDemo.getState().openDoc('D-U01')
  render(<DocDrawer />)
  expect(await screen.findByRole('link', { name: /Mở bản gốc/ })).toHaveAttribute('href', '/api/documents/D-U01/file')
  expect(screen.queryByRole('button', { name: /^Duyệt/ })).toBeNull()
  expect(screen.getByText('Đã duyệt')).toBeInTheDocument()
  expect(screen.getByText('“ok”')).toBeInTheDocument()
})

test('clicking a linked node closes the drawer and navigates there; Escape closes', async () => {
  useDemo.getState().openDoc('D-07')
  render(<DocDrawer />)
  await userEvent.click(await screen.findByRole('button', { name: 'LOT-B' }))
  expect(useDemo.getState().docId).toBeNull()
  expect([useDemo.getState().view, useDemo.getState().plantAsset]).toEqual(['plant', 'LOT-B'])
  useDemo.getState().openDoc('D-07')
  await screen.findByText('1 cần duyệt')
  await userEvent.keyboard('{Escape}')
  expect(useDemo.getState().docId).toBeNull()
})
