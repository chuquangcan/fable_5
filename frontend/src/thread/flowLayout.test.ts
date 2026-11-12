import { expect, test } from 'vitest'
import type { FlowGraph } from '../api/types'
import flowJson from '../test/fixtures/flow_clm0012.json'
import { flowLayout } from './flowLayout'
import { NODE_H, NODE_W } from './layout'

const flow = flowJson as unknown as FlowGraph

test('spine is one row in order', () => {
  const { nodes } = flowLayout(flow)
  const spine = flow.spine.map((n) => nodes.find((p) => p.id === n.id)!)
  expect(new Set(spine.map((p) => p.y)).size).toBe(1)
  expect(spine.map((p) => p.x)).toEqual([...spine.map((p) => p.x)].sort((a, b) => a - b))
})

test('branches sit under their same-type spine column', () => {
  const { nodes } = flowLayout(flow); const at = (id: string) => nodes.find((p) => p.id === id)!
  expect(at('LOT-A').x).toBe(at('LOT-B').x); expect(at('AGG-LOT-B').x).toBe(at('MH20-0001').x)
  expect(at('LOT-A').y).toBeGreaterThan(at('LOT-B').y)
})

test('column and row arithmetic', () => {
  const { nodes, width } = flowLayout(flow); const at = (id: string) => nodes.find((p) => p.id === id)!
  expect(at('SUP-S1')).toEqual({ id: 'SUP-S1', x: 16, y: 40 })
  expect(at('CLM-0012').x).toBe(16 + 11 * (NODE_W + 20))
  expect(at('SHP-1120').y).toBe(40 + 2 * (NODE_H + 26))
  expect(nodes).toHaveLength(flow.spine.length + flow.branches.length)
  expect(width).toBeGreaterThanOrEqual(at('CLM-0012').x + NODE_W)
})

test('bands group consecutive same-stage columns', () => {
  const { bands } = flowLayout(flow)
  expect(bands.map((b) => b.label)).toEqual(['Supply', 'Warehouse', 'Production', 'Logistics', 'Customer', 'After-sales'])
  const sx = bands.find((b) => b.stage === 'san_xuat')!
  expect(sx.w).toBe(3 * (NODE_W + 20))
})
