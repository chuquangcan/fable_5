import { expect, test } from 'vitest'
import type { PlantArea, PlantState } from '../api/types'
import plant from '../test/fixtures/plant.json'
import state from '../test/fixtures/plant_state.json'
import { TWIN_COL_X, twinLayout } from './twinLayout'

const L = twinLayout(plant as PlantArea[], state as PlantState)
const at = (id: string) => L.nodes.find((n) => n.id === id)!

test('each line is one row: header, its hopper, then its machines', () => {
  expect(new Set(['LINE-1', 'HOP-1', 'M02'].map((id) => at(id).row)).size).toBe(1)
  expect(new Set(['LINE-2', 'HOP-2', 'M01', 'M03'].map((id) => at(id).row)).size).toBe(1)
  expect(at('LINE-1').row).not.toBe(at('LINE-2').row)
  expect([at('LINE-2').x, at('HOP-2').x, at('M01').x, at('M03').x]).toEqual([...new Set([at('LINE-2').x, at('HOP-2').x, at('M01').x, at('M03').x])].sort((a, b) => a - b))
  expect(at('M02').line).toBe('Line 1')
  expect(at('LINE-1').col).toBe(1)
})

test('columns run left to right: lots, lines, inspection, volume and shipments', () => {
  expect(at('LOT-B').x).toBeLessThan(at('HOP-1').x)
  expect(at('HOP-1').x).toBeLessThan(at('IQC-5531').x)
  expect(at('IQC-5531').x).toBeLessThan(at('SHP-1112').x)
  expect([at('RCV-2810').col, at('LOT-B').col, at('IQC-5531').col, at('VOL').col, at('SHP-1112').col]).toEqual([0, 0, 2, 3, 3])
  expect(at('VOL')).toMatchObject({ type: 'volume', name: '1,000 serial · 42 boxes' })
  expect(at('LOT-A').x).toBe(TWIN_COL_X[0])
})

test('only edges between laid-out nodes are kept; the frame holds every node', () => {
  const ids = new Set(L.nodes.map((n) => n.id))
  expect(L.edges.length).toBeGreaterThan(0)
  expect(L.edges.every((e) => ids.has(e.from_id) && ids.has(e.to_id))).toBe(true)
  expect(Math.max(...L.nodes.map((n) => n.x))).toBeLessThan(L.width)
  expect(Math.max(...L.nodes.map((n) => n.y))).toBeLessThan(L.height)
})
