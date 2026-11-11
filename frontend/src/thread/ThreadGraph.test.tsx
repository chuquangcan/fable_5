import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import type { TraceGraph } from '../api/types'
import traceJson from '../test/fixtures/trace.json'
import { useDemo } from '../store/demo'
import { edgeStyle } from './layout'
import { ThreadGraph } from './ThreadGraph'

const trace = traceJson as unknown as TraceGraph

beforeEach(() => useDemo.getState().reset())

test('renders only laid-out nodes', () => {
  render(<ThreadGraph trace={trace} />)
  for (const label of ['CLM-0012', 'MH20-0001', 'Machine 02', 'LOT-B', 'IQC-5531', 'D-07'])
    expect(screen.getByText(label)).toBeInTheDocument()
  expect(screen.queryByText('CUS-C3')).toBeNull()
  expect(screen.queryByText('LOT-A')).toBeNull()
})

test('edge styles by status', () => {
  expect(edgeStyle('confirmed')).toEqual({ stroke: '#0E7C86' })
  expect(edgeStyle('inferred').strokeDasharray).toBe('5 4')
  expect(edgeStyle('pending').strokeDasharray).toBe('2 3')
  expect(edgeStyle('suggested').stroke).toBe('#8E959F')
})

test('clicking nodes switches evidence tab', async () => {
  render(<ThreadGraph trace={trace} />)
  await userEvent.click(screen.getByText('LOT-B'))
  expect(useDemo.getState().evidenceTab).toBe('lot')
  await userEvent.click(screen.getByText('Machine 02'))
  expect(useDemo.getState().evidenceTab).toBe('m02')
  await userEvent.click(screen.getByText('IQC-5531'))
  expect(useDemo.getState().evidenceTab).toBe('lot')
})

test('focused node gets a teal outline', () => {
  useDemo.getState().focusNode('IQC-5531')
  render(<ThreadGraph trace={trace} />)
  expect(screen.getByText('IQC-5531').closest('button')).toHaveStyle({ outline: '2px solid #0E7C86' })
})
