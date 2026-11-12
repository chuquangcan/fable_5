import type { Asset, PlantArea, PlantState, TwinEdge } from '../api/types'

export const TWIN_NODE_W = 148
export const TWIN_NODE_H = 58
const SLOT = TWIN_NODE_W + 24
/** Column x: 0 receipts and lots · 1 one row per line (header, hopper, machines) · 2 inspection · 3 volume and shipments.
 *  Column 1 holds a header, a hopper and up to three machines per row. */
export const TWIN_COL_X = [24, 24 + SLOT + 48, 24 + SLOT + 48 + 5 * SLOT + 24, 24 + SLOT + 48 + 6 * SLOT + 72] as const
export const TWIN_ROW_H = 86
const TOP = 40
export const COLUMN_LABELS = ['Receiving · lots', 'Production lines', 'Quality', 'Finished goods · shipping']

export interface TwinNodeData { id: string; type: string; name: string; col: 0 | 1 | 2 | 3; row: number; x: number; y: number; line?: string }

/** Row membership already shows which line a hopper or machine belongs to, so part_of is not drawn. */
const DRAWN = new Set(['fed_into', 'received_under', 'inspected'])

export function twinLayout(areas: PlantArea[], state: PlantState): { nodes: TwinNodeData[]; edges: TwinEdge[]; width: number; height: number } {
  const items = areas.flatMap((a) => a.groups.flatMap((g) => g.items))
  const ofType = (...types: string[]) => items.filter((i) => types.includes(i.type)).sort((a, b) => a.id.localeCompare(b.id))
  const lineOf = new Map(state.edges.filter((e) => e.relation === 'part_of').map((e) => [e.from_id, e.to_id]))
  const nodes: TwinNodeData[] = []
  const put = (a: Pick<Asset, 'id' | 'type'>, name: string, col: 0 | 1 | 2 | 3, row: number, slot = 0, line?: string) =>
    nodes.push({ id: a.id, type: a.type, name, col, row, x: TWIN_COL_X[col] + slot * SLOT, y: TOP + row * TWIN_ROW_H, ...(line ? { line } : {}) })

  ofType('receipt', 'lot').forEach((a, r) => put(a, a.id, 0, r))

  const lines = ofType('line')
  const members = ofType('hopper', 'machine')
  const rows: { line?: Asset; parts: Asset[] }[] = lines.map((l) => ({
    line: l, parts: [...members.filter((m) => m.type === 'hopper' && lineOf.get(m.id) === l.id), ...members.filter((m) => m.type === 'machine' && lineOf.get(m.id) === l.id)],
  }))
  const loose = members.filter((m) => !lines.some((l) => l.id === lineOf.get(m.id)))
  if (loose.length) rows.push({ parts: loose })
  rows.forEach(({ line, parts }, r) => {
    if (line) put(line, line.name, 1, r)
    parts.forEach((p, i) => put(p, p.id, 1, r, i + 1, line?.name))
  })

  ofType('inspection').forEach((a, r) => put(a, a.id, 2, r))

  const volume = areas.map((a) => a.volume).filter(Boolean).join(' · ')
  put({ id: 'VOL', type: 'volume' }, volume || 'Volume', 3, 0)
  ofType('shipment').forEach((a, r) => put(a, a.id, 3, r + 1))

  const ids = new Set(nodes.map((n) => n.id))
  const edges = state.edges.filter((e) => DRAWN.has(e.relation) && ids.has(e.from_id) && ids.has(e.to_id))
  const width = Math.max(...nodes.map((n) => n.x)) + TWIN_NODE_W + 24
  const height = Math.max(...nodes.map((n) => n.y)) + TWIN_NODE_H + 48
  return { nodes, edges, width, height }
}
