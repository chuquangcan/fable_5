import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import type { Claim, TraceGraph } from '../api/types'
import { useDemo } from '../store/demo'
import { ClaimsSidebar } from './ClaimsSidebar'

vi.mock('../api/client')

const claims: Claim[] = [
  { id: 'CLM-0012', name: 'CLM-0012', status: 'open', symptom: 'Bơm kêu to bất thường khi chạy', customer_id: 'CUS-C3', customer_name: 'Customer C3', serial: 'MH20-0001', received: '2027-02-10' },
  { id: 'CLM-0011', name: 'CLM-0011', status: 'open', symptom: 'Rò nước', customer_id: 'CUS-C1', customer_name: 'Customer C1', serial: 'MH20-2457', received: '2027-02-03' },
  { id: 'CLM-0009', name: 'CLM-0009', status: 'closed', symptom: 'Tiếng ồn ổ bi 6203', customer_id: null, customer_name: null, serial: null, received: null },
]

const edge = (from_id: string, to_id: string, status: string, score = 1) => ({ from_id, to_id, relation: 'x', tier: 1, status, score })
const trace = {
  root: 'MH20-0001',
  nodes: [{ id: 'D-07', type: 'document', name: 'Biên bản họp · tr.2', attributes: {} }],
  edges: [edge('a', 'b', 'confirmed'), edge('b', 'c', 'confirmed'), edge('c', 'd', 'inferred', 0.81), edge('D-07', 'LOT-B', 'pending', 0.78), edge('D-03', 'CLM-0009', 'suggested', 0.64)],
} as TraceGraph

beforeEach(() => {
  useDemo.getState().reset()
  vi.mocked(api.getClaims).mockResolvedValue(claims)
  vi.mocked(api.getTrace).mockResolvedValue(trace)
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
  expect(screen.queryByRole('button', { name: /CLM-0009/ })).toBeNull()
})

test('confidence counts and review queue appear only after a claim is opened', async () => {
  render(<ClaimsSidebar />)
  await screen.findByText('CLM-0012')
  expect(screen.queryByText(/Confirmed · bậc 1–2/)).toBeNull()
  expect(screen.queryByText('D-07 → LOT-B')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /CLM-0012/ }))
  await waitFor(() => expect(screen.getByText('D-07 → LOT-B')).toBeInTheDocument())
  expect(api.getTrace).toHaveBeenCalledWith('MH20-0001')
  expect(screen.getByText(/Confirmed · bậc 1–2/).parentElement).toHaveTextContent('2')
  expect(screen.getByText(/Chờ duyệt · bậc 4/).parentElement).toHaveTextContent('1')
  expect(screen.getByText('0.78')).toBeInTheDocument()
})

test('alias block is always shown', async () => {
  render(<ClaimsSidebar />)
  expect(await screen.findByText('S1-6203-B')).toBeInTheDocument()
})

test('a data write refetches the claims and the open claim trace', async () => {
  render(<ClaimsSidebar />)
  await userEvent.click(await screen.findByRole('button', { name: /CLM-0012/ }))
  await waitFor(() => expect(api.getTrace).toHaveBeenCalledTimes(1))
  expect(api.getClaims).toHaveBeenCalledTimes(1)
  act(() => useDemo.getState().bumpData())
  await waitFor(() => expect(api.getTrace).toHaveBeenCalledTimes(2))
  expect(api.getClaims).toHaveBeenCalledTimes(2)
})
