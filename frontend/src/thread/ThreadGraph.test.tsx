import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import type { FlowGraph } from '../api/types'
import flowJson from '../test/fixtures/flow_clm0012.json'
import { useDemo } from '../store/demo'
import { edgeStyle, neutralEdgeStyle } from './layout'
import { ThreadGraph } from './ThreadGraph'

const flow = flowJson as unknown as FlowGraph

beforeEach(() => useDemo.getState().reset())

test('renders every spine and branch node', () => {
  render(<ThreadGraph flow={flow} />)
  // getAllByText: "Customer C5" is both CUS-C5's title and SO-7790's subtitle in the fixture.
  for (const l of ['CLM-0012', 'MH20-0001', 'Machine 02', 'LOT-B', 'LOT-A', 'Customer C5']) expect(screen.getAllByText(l)[0]).toBeInTheDocument()
  expect(screen.getByTestId('att-SUP-S1')).toHaveTextContent('3 đính kèm') // CLM-0009, D-09, D-03
  expect(screen.getByTestId('att-LOT-B')).toHaveTextContent('6 đính kèm')
  expect(screen.queryByTestId('att-PO-4410')).toBeNull()
})

test('stage bands are labelled', () => {
  render(<ThreadGraph flow={flow} />)
  for (const l of ['Cung ứng', 'Kho', 'Sản xuất', 'Logistics', 'Khách hàng', 'Hậu mãi']) expect(screen.getByText(l)).toBeInTheDocument()
})

test('normal mode has no fault colours', () => {
  useDemo.setState({ mode: 'normal' })
  const { container } = render(<ThreadGraph flow={flow} />)
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
  useDemo.setState({ mode: 'fault' })
  render(<ThreadGraph flow={flow} />)
  await userEvent.click(screen.getByText('LOT-B'))
  expect(useDemo.getState().evidenceTab).toBe('lot')
  expect(useDemo.getState().focusNodeId).toBe('LOT-B')
  await userEvent.click(screen.getByText('Machine 02'))
  expect(useDemo.getState().evidenceTab).toBe('m02')
  await userEvent.click(screen.getByText('LOT-B'))
  expect(useDemo.getState().evidenceTab).toBe('lot')
})

test('focused node gets a teal outline', () => {
  useDemo.getState().focusNode('LOT-B')
  render(<ThreadGraph flow={flow} />)
  expect(screen.getByText('LOT-B').closest('button')).toHaveStyle({ outline: '2px solid #0E7C86' })
})
