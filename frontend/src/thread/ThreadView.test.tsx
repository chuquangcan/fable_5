import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import type { Claim, FlowGraph, TraceGraph } from '../api/types'
import compare from '../test/fixtures/compare.json'
import cpk from '../test/fixtures/cpk.json'
import flow from '../test/fixtures/flow_clm0012.json'
import impact from '../test/fixtures/impact.json'
import trace from '../test/fixtures/trace.json'
import { useDemo } from '../store/demo'
import { ThreadView } from './ThreadView'

vi.mock('../api/client')

const claim: Claim = {
  id: 'CLM-0012', name: 'CLM-0012', status: 'open', symptom: 'noise', customer_id: 'CUS-C3',
  customer_name: 'Customer C3', serial: 'MH20-0001', received: '2027-02-10',
}

beforeEach(() => {
  useDemo.getState().reset()
  vi.mocked(api.getClaim).mockResolvedValue(claim)
  vi.mocked(api.getTrace).mockResolvedValue(trace as unknown as TraceGraph)
  vi.mocked(api.getFlow).mockResolvedValue(flow as unknown as FlowGraph)
  vi.mocked(api.getEvents).mockResolvedValue([])
  vi.mocked(api.getDocs).mockResolvedValue([])
  vi.mocked(api.getCompare).mockResolvedValue(compare as never)
  vi.mocked(api.getMetric).mockResolvedValue(cpk as never)
  vi.mocked(api.getImpact).mockResolvedValue(impact as never)
})

test('fetches the flow by claim and toggles fault mode from the toolbar', async () => {
  useDemo.getState().openClaim('CLM-0012')
  render(<ThreadView />)
  const toggle = await screen.findByRole('button', { name: 'Truy lỗi' })
  expect(api.getFlow).toHaveBeenCalledWith('CLM-0012')
  expect(screen.getByTestId('att-SUP-S1')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Lanes' })).toBeNull()
  expect(screen.queryByText('nạp LOT-B 13:52')).toBeNull()
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(toggle)
  expect(useDemo.getState().mode).toBe('normal')
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(toggle)
  expect(useDemo.getState().mode).toBe('fault')
})

test('graph area scrolls horizontally on its own', async () => {
  useDemo.getState().openClaim('CLM-0012')
  render(<ThreadView />)
  expect(await screen.findByTestId('graph-scroll')).toHaveStyle({ overflowX: 'auto' })
})
