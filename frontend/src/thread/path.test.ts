import { expect, test } from 'vitest'
import type { FlowGraph } from '../api/types'
import flow from '../test/fixtures/flow_clm0012.json'
import { pathEdges } from './path'

const f = flow as unknown as FlowGraph

test('path from the root serial up to the lot follows the flow edges', () => {
  const p = pathEdges(f, 'LOT-B')
  expect([...p].sort()).toEqual(['HOP-1>fed_into>M02', 'LOT-B>fed_into>HOP-1', 'M02>processed_on>MH20-0001'].sort())
})

test('no path for the root itself, an unknown node or nothing focused', () => {
  expect(pathEdges(f, f.root).size).toBe(0)
  expect(pathEdges(f, 'NOPE').size).toBe(0)
  expect(pathEdges(f, null).size).toBe(0)
})
