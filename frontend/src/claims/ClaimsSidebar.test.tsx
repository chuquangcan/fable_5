import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import type { Claim, TraceGraph } from '../api/types'
import { useDemo } from '../store/demo'
import { ClaimsSidebar } from './ClaimsSidebar'

vi.mock('../api/client')

const claims: Claim[] = [
  { id: 'CLM-0012', name: 'CLM-0012', status: 'open', symptom: 'Pump is abnormally noisy when running', customer_id: 'CUS-C3', customer_name: 'Customer C3', serial: 'MH20-0001', received: '2027-02-10' },
  { id: 'CLM-0011', name: 'CLM-0011', status: 'open', symptom: 'Water leak', customer_id: 'CUS-C1', customer_name: 'Customer C1', serial: 'MH20-2457', received: '2027-02-03' },
  { id: 'CLM-0009', name: 'CLM-0009', status: 'closed', symptom: 'Bearing 6203 noise', customer_id: null, customer_name: null, serial: null, received: null },
]

const edge = (from_id: string, to_id: string, status: string, score = 1) => ({ from_id, to_id, relation: 'x', tier: 1, status, score })
const trace = {
  root: 'MH20-0001',
  nodes: [{ id: 'D-07', type: 'document', name: 'Meeting minutes · p.2', attributes: {} }],
  edges: [edge('a', 'b', 'confirmed'), edge('b', 'c', 'confirmed'), edge('c', 'd', 'inferred', 0.81), edge('D-07', 'LOT-B', 'pending', 0.78), edge('D-03', 'CLM-0009', 'suggested', 0.64)],
} as TraceGraph

const item = (link_id: number, from_id: string, to_id: string, status: string, score: number, doc_id: string | null) => ({
  link_id, from_id, from_name: from_id === doc_id ? 'meeting_minutes p.1' : from_id, from_type: from_id === doc_id ? 'document' : 'claim',
  to_id, to_name: to_id, to_type: 'lot', relation: 'mentions', tier: 4, status, score, method: null, reason: null, doc_id,
})
const queue = { pending: [item(17, 'D-07', 'LOT-B', 'pending', 0.78, 'D-07'), item(14, 'CLM-0009', 'SUP-S1', 'inferred', 0.81, null)], decided: [] }

beforeEach(() => {
  useDemo.getState().reset()
  vi.mocked(api.getClaims).mockResolvedValue(claims)
  vi.mocked(api.getTrace).mockResolvedValue(trace)
  vi.mocked(api.getReviewQueue).mockResolvedValue(queue as never)
})

test('clicking CLM-0012 opens the thread; CLM-0011 is static', async () => {
  render(<ClaimsSidebar />)
  await userEvent.click(await screen.findByRole('button', { name: /CLM-0012/ }))
  const s = useDemo.getState()
  expect(s.activeTab).toBe('thread')
  expect(s.claimId).toBe('CLM-0012')
  expect(s.openTabs).toEqual(['claim', 'thread'])
  expect(screen.getByText('CLM-0011')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /CLM-0011/ })).toBeNull()
  // CLM-0009 still appears in the review queue (CLM-0009 → SUP-S1), but never as a claim button
  expect(screen.queryAllByRole('button', { name: /CLM-0009/ }).filter((b) => !b.textContent?.includes('→'))).toHaveLength(0)
})

test('confidence counts appear only after a claim is opened', async () => {
  render(<ClaimsSidebar />)
  await screen.findByText('CLM-0012')
  expect(screen.queryByText(/Confirmed · tier 1–2/)).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /CLM-0012/ }))
  await waitFor(() => expect(screen.getByText(/Confirmed · tier 1–2/)).toBeInTheDocument())
  expect(api.getTrace).toHaveBeenCalledWith('MH20-0001')
  expect(screen.getByText(/Confirmed · tier 1–2/).parentElement).toHaveTextContent('2')
  expect(screen.getByText(/Pending review · tier 4/).parentElement).toHaveTextContent('1')
})

test('the review queue is global; a doc item opens its drawer, a non-doc item the full queue', async () => {
  render(<ClaimsSidebar />)
  expect(await screen.findByText('D-07 → LOT-B')).toBeInTheDocument()
  expect(screen.getByText('Pending review · 0.78')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Approve/ })).toBeNull()  // decisions are made in the drawer / data view
  await userEvent.click(screen.getByText('D-07 → LOT-B'))
  expect(useDemo.getState().docId).toBe('D-07')
  await userEvent.click(screen.getByText('CLM-0009 → SUP-S1'))
  expect([useDemo.getState().view, useDemo.getState().dataTab]).toEqual(['data', 'review'])
})

test('a data write refetches the claims and the open claim trace', async () => {
  render(<ClaimsSidebar />)
  await userEvent.click(await screen.findByRole('button', { name: /CLM-0012/ }))
  await waitFor(() => expect(api.getTrace).toHaveBeenCalledTimes(1))
  expect(api.getClaims).toHaveBeenCalledTimes(1)
  act(() => useDemo.getState().bumpData())
  await waitFor(() => expect(api.getTrace).toHaveBeenCalledTimes(2))
  expect(api.getClaims).toHaveBeenCalledTimes(2)
  expect(api.getReviewQueue).toHaveBeenCalledTimes(2)
})
