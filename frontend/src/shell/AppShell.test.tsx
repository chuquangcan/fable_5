import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import { useDemo } from '../store/demo'
import { AppShell } from './AppShell'

vi.mock('../api/client')

const s = () => useDemo.getState()

beforeEach(() => {
  try { localStorage.clear() } catch { /* no storage */ }
  s().reset()
  vi.mocked(api.getProvider).mockResolvedValue({ provider: null, mode: 'replay' } as never)
  vi.mocked(api.getReviewQueue).mockResolvedValue({ pending: [], decided: [] })
  // tab content is real now: its loads stay pending, these tests are about the shell
  const pending = () => new Promise<never>(() => {})
  for (const f of ['getFlow', 'getTrace', 'getClaim', 'getClaimFault', 'getSummary'] as const) vi.mocked(api[f]).mockImplementation(pending)
})

test('header shows the as-of time and the demo badge; the status line says read-only', () => {
  render(<AppShell left={null} right={null} />)
  expect(screen.getByText('2026-11-03 14:05')).toBeInTheDocument()
  expect(screen.getByText('DEMO · SAMPLE DATA')).toBeInTheDocument()
  expect(screen.getByText(/read-only/)).toBeInTheDocument()
})

test('the activity bar swaps only the left rail; open tabs survive', () => {
  s().openProduct('MH20-0457')
  const tabs = s().groups.main.tabs
  render(<AppShell left={null} right={null} />)
  fireEvent.click(screen.getByRole('button', { name: 'Assets' }))
  expect(s().layout.rail).toBe('assets')
  fireEvent.click(screen.getByRole('button', { name: 'Data repository' }))
  expect(s().layout.rail).toBe('data')
  expect(s().groups.main.tabs).toBe(tabs)
})

test('the dock resizes from its top edge within limits, and collapses on double-click', () => {
  render(<AppShell left={null} right={null} />)
  const edge = screen.getByRole('separator', { name: 'Resize panel' })
  fireEvent.mouseDown(edge, { clientY: 500 })
  fireEvent.mouseMove(window, { clientY: 400 })
  fireEvent.mouseUp(window)
  expect(s().layout.dockH).toBe(400)
  fireEvent.mouseDown(edge, { clientY: 500 })
  fireEvent.mouseMove(window, { clientY: 900 })
  fireEvent.mouseUp(window)
  expect(s().layout.dockH).toBe(120)
  fireEvent.keyDown(edge, { key: 'ArrowUp' })
  expect(s().layout.dockH).toBe(136)
  fireEvent.doubleClick(edge)
  expect(s().layout.dockCollapsed).toBe(true)
})

test('the left rail and the agent rail resize', () => {
  render(<AppShell left={null} right={null} />)
  const left = screen.getByRole('separator', { name: 'Resize left panel' })
  fireEvent.mouseDown(left, { clientX: 300 })
  fireEvent.mouseMove(window, { clientX: 1000 })
  fireEvent.mouseUp(window)
  expect(s().layout.leftW).toBe(480)
  const agent = screen.getByRole('separator', { name: 'Resize agent panel' })
  fireEvent.mouseDown(agent, { clientX: 1000 })
  fireEvent.mouseMove(window, { clientX: 960 })
  fireEvent.mouseUp(window)
  expect(s().layout.agentW).toBe(380)
})

test('the report button opens the active product tab claim report', () => {
  s().openClaim('CLM-0012', 'MH20-0001')
  render(<AppShell left={null} right={null} />)
  fireEvent.click(screen.getByRole('button', { name: 'Report' }))
  expect(s().groups.main.active).toBe('report:CLM-0012')
})

test('the status line review button reopens the review queue in the dock', () => {
  s().closeTab('bottom', 'review')
  render(<AppShell left={null} right={null} />)
  fireEvent.click(screen.getByRole('button', { name: /Review queue/ }))
  expect(s().groups.bottom.active).toBe('review')
})
