import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import fixture from '../../public/fixtures/agent_clm0012.json'
import * as api from '../api/client'
import { DockContent } from '../shell/tabContent'
import { threadTabId, useDemo } from '../store/demo'
import m02 from '../test/fixtures/summary_m02.json'
import pm0241 from '../test/fixtures/summary_pm0241.json'
import { AgentPanel, CiteChip } from './AgentPanel'

vi.mock('../api/client')

const T = threadTabId('MH20-0001')
const p = () => useDemo.getState().product[T]

beforeEach(() => {
  useDemo.getState().reset()
  vi.mocked(api.getFeed).mockResolvedValue([])
  vi.mocked(api.getPlantOverview).mockImplementation(() => new Promise(() => {}))  // the dock opens on the overview
  vi.mocked(api.getSummary).mockImplementation(async (id) => {
    if (id === 'PM-0241') return pm0241 as never
    if (id === 'GHOST-1') throw new Error('404 object GHOST-1 not found')
    return m02 as never
  })
})

/** The claim's thread is open and loaded: these ids are on it. */
function openThread() {
  useDemo.getState().openClaim('CLM-0012', 'MH20-0001')
  useDemo.getState().setThreadIds(T, ['MH20-0001', 'LOT-B', 'IQC-5531', 'PO-4410'])
}

test('unknown cite is not clickable', () => { // Review Focus #3
  render(<CiteChip label="IQC-9999" target_id={null} />)
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.getByText('IQC-9999')).toBeInTheDocument()
})

test('a cite on the open thread focuses its node there', async () => {
  openThread()
  render(<CiteChip label="LOT-B" target_id="LOT-B" />)
  await userEvent.click(screen.getByRole('button', { name: 'LOT-B' }))
  expect(p().focusNodeId).toBe('LOT-B')
})

test('a cite in fault mode opens the matching evidence tab', async () => {
  openThread()
  render(<CiteChip label="IQC-5531" target_id="IQC-5531" />)
  await userEvent.click(screen.getByRole('button', { name: 'IQC-5531' }))
  expect([p().focusNodeId, useDemo.getState().evidence[T]]).toEqual(['IQC-5531', 'lot'])
})

test('a document cite opens a document tab, not a graph node', async () => {
  openThread()
  render(<CiteChip label="D-12 p.7" target_id="D-12" />)
  await userEvent.click(screen.getByRole('button'))
  expect(useDemo.getState().groups.main.tabs.some((t) => t.id === 'doc:D-12')).toBe(true)
  expect(p().focusNodeId).toBeNull()
})

test('a node cite without a deep evidence tab opens the overview', async () => {
  openThread()
  useDemo.getState().setEvidence(T, 'impact')
  render(<CiteChip label="PO-4410" target_id="PO-4410" />)
  await userEvent.click(screen.getByRole('button'))
  expect([p().focusNodeId, useDemo.getState().evidence[T]]).toEqual(['PO-4410', 'overview'])
})

function Dock() {
  const tab = useDemo((s) => s.groups.bottom.tabs.find((t) => t.id === s.groups.bottom.active) ?? null)
  return <DockContent tab={tab} />
}

test('a cite to an event record shows its summary in the dock, not the error panel', async () => {
  render(<><CiteChip label="PM-0241" target_id="PM-0241" /><CiteChip label="GHOST-1" target_id="GHOST-1" /><Dock /></>)
  await userEvent.click(screen.getByRole('button', { name: 'PM-0241' }))
  expect(await screen.findByText('maintenance · 2026-10-20 09:00 · Event')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Set as fault origin' })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'GHOST-1' }))
  expect(await screen.findByText('No summary for GHOST-1')).toBeInTheDocument()
  expect(screen.queryByText(/Could not load data/)).toBeNull()
})

test('the panel shows the workspace context under its title and follows it', async () => {
  render(<AgentPanel />)
  expect(screen.getByTestId('agent-context')).toHaveTextContent('Plant')
  act(() => useDemo.getState().selectTwin('M02', 'Line 1 › M02'))
  expect(screen.getByTestId('agent-context')).toHaveTextContent('Plant › M02')
  act(() => openThread())
  act(() => useDemo.getState().selectNode(T, 'LOT-B'))
  expect(screen.getByTestId('agent-context')).toHaveTextContent('Thread · MH20-0001 (CLM-0012) › LOT-B')
})

test('?step=4 asks the demo question; reset clears the answer', async () => {
  // instant replay: no delays
  const fast = { ...fixture, events: fixture.events.map((e: { event: unknown }) => ({ ...e, delay_ms: 0 })) }
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(fast))))
  try {
    render(<AgentPanel />)
    act(() => useDemo.getState().applyStep(4))
    expect(await screen.findByText(/Why is MH20-0001 from CLM-0012 noisy/)).toHaveClass('bubble', 'user')
    expect((await screen.findAllByTestId('agent-bubble')).every((b) => b.classList.contains('agent'))).toBe(true)
    act(() => useDemo.getState().reset())
    expect(await screen.findByText(/Ask about this claim, or press/)).toBeInTheDocument()
  } finally {
    vi.unstubAllGlobals()
  }
})
