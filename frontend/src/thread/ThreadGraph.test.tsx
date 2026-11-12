import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import type { FaultTrace, FlowGraph } from '../api/types'
import faultJson from '../test/fixtures/fault_clm0012.json'
import flowJson from '../test/fixtures/flow_clm0012.json'
import type { ReactNode } from 'react'
import { threadTabId, useDemo } from '../store/demo'
import { ProductTabContext } from './ProductTabContext'
import { edgeStyle, faultEdgeStyle, neutralEdgeStyle } from './layout'
import { LinkLegend } from './LinkLegend'
import { ThreadGraph } from './ThreadGraph'

const flow = flowJson as unknown as FlowGraph

const T = threadTabId('MH20-0001')
const inTab = (ui: ReactNode) => <ProductTabContext.Provider value={T}>{ui}</ProductTabContext.Provider>
const p = () => useDemo.getState().product[T]

beforeEach(() => {
  useDemo.getState().reset()
  useDemo.getState().openClaim('CLM-0012', 'MH20-0001')  // fault mode
})

test('renders every spine and branch node', () => {
  render(inTab(<ThreadGraph flow={flow} />))
  // getAllByText: "Customer C5" is both CUS-C5's title and SO-7790's subtitle in the fixture.
  for (const l of ['CLM-0012', 'MH20-0001', 'Machine 02', 'LOT-B', 'LOT-A', 'Customer C5']) expect(screen.getAllByText(l)[0]).toBeInTheDocument()
  expect(screen.getByTestId('att-SUP-S1')).toHaveTextContent('3 attached') // CLM-0009, D-09, D-03
  expect(screen.getByTestId('att-LOT-B')).toHaveTextContent('6 attached')
  expect(screen.queryByTestId('att-PO-4410')).toBeNull()
})

test('the flashed node gets the flash class, others do not', () => {
  useDemo.setState({ flashNodeId: 'LOT-B' })
  const { container } = render(inTab(<ThreadGraph flow={flow} />))
  const flashed = container.querySelectorAll('.gn-flash')
  expect(flashed).toHaveLength(1)
  expect(flashed[0]).toHaveTextContent('LOT-B')
})

test('stage bands are labelled', () => {
  render(inTab(<ThreadGraph flow={flow} />))
  for (const l of ['Supply', 'Warehouse', 'Production', 'Logistics', 'Customer', 'After-sales']) expect(screen.getByText(l)).toBeInTheDocument()
})

test('normal mode has no fault colours', () => {
  useDemo.getState().setMode(T, 'normal')
  const { container } = render(inTab(<ThreadGraph flow={flow} />))
  expect(container.querySelectorAll('.gn-red, .gn-orange')).toHaveLength(0)
})

test('edge styles by status', () => {
  expect(edgeStyle('confirmed')).toEqual({ stroke: '#0E7C86' })
  expect(edgeStyle('inferred').strokeDasharray).toBe('5 4')
  expect(edgeStyle('pending').strokeDasharray).toBe('2 3')
  expect(edgeStyle('suggested').stroke).toBe('#8E959F')
})

test('neutral edge style keeps the dash but greys the stroke', () => {
  expect(neutralEdgeStyle('confirmed')).toEqual({ stroke: '#8E959F' })
  expect(neutralEdgeStyle('inferred')).toEqual({ stroke: '#8E959F', strokeDasharray: '5 4' })
})

test('clicking nodes switches evidence tab', async () => {
  render(inTab(<ThreadGraph flow={flow} />))
  await userEvent.click(screen.getByText('LOT-B'))
  expect(useDemo.getState().evidence[T]).toBe('lot')
  expect(p().focusNodeId).toBe('LOT-B')
  await userEvent.click(screen.getByText('Machine 02'))
  expect(useDemo.getState().evidence[T]).toBe('machine')
  await userEvent.click(screen.getByText('LOT-B'))
  expect(useDemo.getState().evidence[T]).toBe('lot')
})

test('focused node gets a teal outline', () => {
  useDemo.getState().focusNode(T, 'LOT-B')
  render(inTab(<ThreadGraph flow={flow} />))
  expect(screen.getByText('LOT-B').closest('button')).toHaveStyle({ outline: '2px solid #0E7C86' })
})

const fault = faultJson as unknown as FaultTrace
const toMarks = (f: FaultTrace) => ({
  marks: Object.fromEntries([...f.red.map((m) => [m.id, 'red' as const]), ...f.orange.map((m) => [m.id, 'orange' as const])]),
  reasons: Object.fromEntries([...f.red, ...f.orange].map((m) => [m.id, m.reason])),
})

test('fault marks colour 7 red and 12 orange nodes; the claim stays unmarked with a black border', () => {
  const { marks, reasons } = toMarks(fault)
  const { container } = render(inTab(<ThreadGraph flow={flow} marks={marks} reasons={reasons} />))
  expect(container.querySelectorAll('.gn-red')).toHaveLength(7)
  expect(container.querySelectorAll('.gn-orange')).toHaveLength(12)
  const claim = screen.getByText('CLM-0012').closest('button')!
  expect(claim).not.toHaveClass('gn-red')
  expect(claim).not.toHaveClass('gn-orange')
  expect(claim).toHaveStyle({ border: '2px solid #000' })
  expect(screen.getByText('LOT-B').closest('button')).toHaveAttribute('title', 'upstream of MH20-0001 via uses_lot')
})

test('fault legend is shown only with marks', () => {
  const { marks } = toMarks(fault)
  const { unmount } = render(inTab(<ThreadGraph flow={flow} marks={marks} />))
  expect(screen.getByText('Red: fault origin and upstream · Orange: downstream possibly affected')).toBeInTheDocument()
  unmount()
  render(inTab(<ThreadGraph flow={flow} />))
  expect(screen.queryByText(/Red: fault origin/)).toBeNull()
})

test('edges between two red nodes are thick red; others keep their style', () => {
  expect(faultEdgeStyle('red', 'red')).toEqual({ stroke: '#C62828', strokeWidth: 3 })
  expect(faultEdgeStyle('red', 'orange')).toEqual({})
  expect(faultEdgeStyle(undefined, 'red')).toEqual({})
})

test('the claim node keeps the black border even when it carries a tone, and keeps the tone class', () => {
  render(inTab(<ThreadGraph flow={flow} marks={{ 'CLM-0012': 'red' }} reasons={{ 'CLM-0012': 'fault origin' }} />))
  const claim = screen.getByText('CLM-0012').closest('button')!
  expect(claim).toHaveClass('gn-red')
  expect(claim).toHaveStyle({ border: '2px solid #000' })
  expect(claim.style.background).toBe('')
})

test('normal mode (no marks) gives the claim no black border', () => {
  render(inTab(<ThreadGraph flow={flow} />))
  expect(screen.getByText('CLM-0012').closest('button')!.style.border).toBe('')
})

test('nodes touched by a hovered feed card are highlighted', () => {
  useDemo.getState().setHover(['LOT-B'])
  render(inTab(<ThreadGraph flow={flow} />))
  expect(screen.getByText('LOT-B').closest('button')).toHaveClass('gn-hover')
  expect(screen.getByText('Machine 02').closest('button')).not.toHaveClass('gn-hover')
})

test('the link legend draws each confidence level with its edge style', () => {
  const { container } = render(<LinkLegend />)
  const dash = (st: string) => (container.querySelector(`[data-status="${st}"] .ln`) as HTMLElement).style.borderTop
  expect(dash('confirmed')).toContain('solid')
  expect(dash('inferred')).toContain('dashed')
  expect(dash('pending')).toContain('dotted')
  expect(dash('suggested')).toContain('dotted')
})
