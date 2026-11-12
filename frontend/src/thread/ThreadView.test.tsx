import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import type { Claim, FaultTrace, FlowGraph, TraceGraph } from '../api/types'
import compare from '../test/fixtures/compare.json'
import cpk from '../test/fixtures/cpk.json'
import fault from '../test/fixtures/fault_clm0012.json'
import flow from '../test/fixtures/flow_clm0012.json'
import impact from '../test/fixtures/impact.json'
import summary from '../test/fixtures/summary_m02.json'
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
  vi.mocked(api.getSummary).mockResolvedValue(summary as never)
  vi.mocked(api.getClaimFault).mockResolvedValue(fault as unknown as FaultTrace)
  vi.mocked(api.getFault).mockResolvedValue({ origin: 'LOT-B', at: fault.at, red: [{ id: 'LOT-B', reason: 'fault origin' }], orange: [] })
})

test('fetches the flow by claim and toggles fault mode from the toolbar', async () => {
  useDemo.getState().openClaim('CLM-0012')
  render(<ThreadView />)
  const toggle = await screen.findByRole('button', { name: 'Trace fault' })
  expect(api.getFlow).toHaveBeenCalledWith('CLM-0012')
  expect(screen.getByTestId('att-SUP-S1')).toBeInTheDocument()
  expect(useDemo.getState().threadRoot).toBe('MH20-0001')
  expect(screen.queryByRole('button', { name: 'Lanes' })).toBeNull()
  expect(screen.queryByText('LOT-B loaded 13:52')).toBeNull()
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(toggle)
  expect(useDemo.getState().mode).toBe('normal')
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(toggle)
  expect(useDemo.getState().mode).toBe('fault')
})

test('toolbar attach button opens the dialog; dataVersion refetches only the flow', async () => {
  useDemo.getState().openClaim('CLM-0012')
  render(<ThreadView />)
  await screen.findByRole('button', { name: 'Trace fault' })
  expect(api.getFlow).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getAllByRole('button', { name: 'Attach document' })[0])
  expect(useDemo.getState().attachOpen).toBe(true)
  act(() => useDemo.getState().bumpData())
  await vi.waitFor(() => expect(api.getFlow).toHaveBeenCalledTimes(2))
  expect(api.getClaim).toHaveBeenCalledTimes(1)
  expect(api.getTrace).toHaveBeenCalledTimes(1)
})

test('graph area scrolls horizontally on its own', async () => {
  useDemo.getState().openClaim('CLM-0012')
  render(<ThreadView />)
  expect(await screen.findByTestId('graph-scroll')).toHaveStyle({ overflowX: 'auto' })
})

test('fault mode colours the graph from the claim fault trace; normal mode fetches nothing', async () => {
  useDemo.getState().openClaim('CLM-0012')
  const { container } = render(<ThreadView />)
  await screen.findByRole('button', { name: 'Trace fault' })
  await vi.waitFor(() => expect(container.querySelectorAll('.gn-red')).toHaveLength(7))
  expect(api.getClaimFault).toHaveBeenCalledWith('CLM-0012')
  expect(api.getFault).not.toHaveBeenCalled()
  expect(container.querySelectorAll('.gn-orange')).toHaveLength(12)
  await userEvent.click(screen.getByRole('button', { name: 'Trace fault' }))
  expect(container.querySelectorAll('.gn-red, .gn-orange')).toHaveLength(0)
})

test('normal mode does not fetch fault data', async () => {
  useDemo.getState().openClaim('CLM-0012')
  useDemo.setState({ mode: 'normal' })
  render(<ThreadView />)
  await screen.findByRole('button', { name: 'Trace fault' })
  expect(api.getClaimFault).not.toHaveBeenCalled()
  expect(api.getFault).not.toHaveBeenCalled()
})

test('a selected fault origin is fetched at the claim time on this thread and can be cleared', async () => {
  useDemo.getState().openClaim('CLM-0012')
  useDemo.getState().setFaultOrigin('LOT-B')
  const { container } = render(<ThreadView />)
  await vi.waitFor(() => expect(api.getFault).toHaveBeenCalledWith('LOT-B', fault.at, 'CLM-0012'))
  expect(await screen.findByText('Fault origin: LOT-B')).toBeInTheDocument()
  await vi.waitFor(() => expect(container.querySelectorAll('.gn-red')).toHaveLength(1))
  await userEvent.click(screen.getByRole('button', { name: 'Back to the claim\'s fault origin' }))
  expect(useDemo.getState().faultOrigin).toBeNull()
  await vi.waitFor(() => expect(container.querySelectorAll('.gn-red')).toHaveLength(7))
  expect(screen.queryByText('Fault origin: LOT-B')).toBeNull()
})

test('a fault fetch error shows an inline message and keeps the graph', async () => {
  vi.mocked(api.getClaimFault).mockRejectedValue(new Error('500 boom'))
  useDemo.getState().openClaim('CLM-0012')
  render(<ThreadView />)
  expect(await screen.findByText('Could not load fault-trace data')).toBeInTheDocument()
  expect(screen.getByTestId('att-SUP-S1')).toBeInTheDocument()
})

test('after an origin change with a pending fetch the previous origin marks are not shown', async () => {
  useDemo.getState().openClaim('CLM-0012')
  const { container } = render(<ThreadView />)
  await vi.waitFor(() => expect(container.querySelectorAll('.gn-red')).toHaveLength(7))
  vi.mocked(api.getFault).mockReturnValue(new Promise(() => {}))
  act(() => useDemo.getState().setFaultOrigin('LOT-B'))
  expect(await screen.findByText('Fault origin: LOT-B')).toBeInTheDocument()
  await vi.waitFor(() => expect(api.getFault).toHaveBeenCalled())
  expect(container.querySelectorAll('.gn-red, .gn-orange')).toHaveLength(0)
})

test('a failing origin fetch shows the error and no stale marks', async () => {
  useDemo.getState().openClaim('CLM-0012')
  const { container } = render(<ThreadView />)
  await vi.waitFor(() => expect(container.querySelectorAll('.gn-red')).toHaveLength(7))
  vi.mocked(api.getFault).mockRejectedValue(new Error('500'))
  act(() => useDemo.getState().setFaultOrigin('LOT-B'))
  expect(await screen.findByText('Could not load fault-trace data')).toBeInTheDocument()
  expect(container.querySelectorAll('.gn-red, .gn-orange')).toHaveLength(0)
})
