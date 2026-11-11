import type { FlowGraph, FlowNode, FlowStage } from '../api/types'
import { NODE_H, NODE_W } from './layout'

/** Display labels for the raw stage codes sent by /api/flow. */
export const STAGES: Record<FlowStage, string> = {
  cung_ung: 'Cung ứng',
  kho: 'Kho',
  san_xuat: 'Sản xuất',
  logistics: 'Logistics',
  khach_hang: 'Khách hàng',
  hau_mai: 'Hậu mãi',
  dinh_kem: 'Đính kèm',
}

export const COL_GAP = 20
export const ROW_GAP = 26
const LEFT = 16
const TOP = 40
/** Room under the lowest row for the "n đính kèm" badge and the edge legend. */
const BOTTOM = 52

export const colX = (i: number) => LEFT + i * (NODE_W + COL_GAP)
export const rowY = (r: number) => TOP + r * (NODE_H + ROW_GAP)

export interface FlowLayout {
  nodes: { id: string; x: number; y: number }[]
  width: number
  height: number
  bands: { stage: string; label: string; x: number; w: number }[]
}

export function flowLayout(flow: FlowGraph): FlowLayout {
  const spineCol = new Map(flow.spine.map((n, i) => [n.id, i]))
  const typeCol = new Map<string, number>()
  flow.spine.forEach((n, i) => { if (!typeCol.has(n.type)) typeCol.set(n.type, i) })
  const branchById = new Map(flow.branches.map((b) => [b.id, b]))
  const memo = new Map<string, number>()

  // Branch column: same-type spine column; otherwise next to its parent (downstream → right, upstream → left).
  // (Falls back to the backend's `order` only when the parent can't be placed.)
  const columnOf = (n: FlowNode, seen: Set<string> = new Set()): number => {
    const known = spineCol.get(n.id) ?? memo.get(n.id) ?? typeCol.get(n.type)
    if (known !== undefined) return known
    let col = n.order ?? 0
    const p = n.parent_id
    if (p && !seen.has(p)) {
      const pBranch = branchById.get(p)
      const pCol = spineCol.get(p) ?? (pBranch ? columnOf(pBranch, new Set(seen).add(n.id)) : undefined)
      if (pCol !== undefined) {
        const downstream = flow.edges.some((e) => e.up === p && e.down === n.id)
        const upstream = flow.edges.some((e) => e.up === n.id && e.down === p)
        col = Math.max(0, pCol + (downstream ? 1 : upstream ? -1 : 0))
      }
    }
    memo.set(n.id, col)
    return col
  }

  const nodes = [
    ...flow.spine.map((n, i) => ({ id: n.id, x: colX(i), y: rowY(0) })),
    ...flow.branches.map((b) => ({ id: b.id, x: colX(columnOf(b)), y: rowY(b.row) })),
  ]

  const bands: FlowLayout['bands'] = []
  flow.spine.forEach((n, i) => {
    const last = bands[bands.length - 1]
    if (last && last.stage === n.stage) last.w += NODE_W + COL_GAP
    else bands.push({ stage: n.stage, label: STAGES[n.stage as FlowStage] ?? n.stage, x: colX(i) - COL_GAP / 2, w: NODE_W + COL_GAP })
  })

  const maxX = Math.max(LEFT, ...nodes.map((p) => p.x))
  const maxY = Math.max(TOP, ...nodes.map((p) => p.y))
  return { nodes, width: maxX + NODE_W + LEFT, height: maxY + NODE_H + BOTTOM, bands }
}
