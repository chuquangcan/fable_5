import type { EdgeStatus } from '../api/types'

export type Tone = 'focus' | 'bad' | 'suspect' | 'pending' | 'suggested'
export interface LayoutItem { x: number; y: number; tone?: Tone; sub: string }

export const NODE_W = 112
export const NODE_H = 34

export const LANES = [
  { x: 18, label: 'Khách hàng · Logistics' },
  { x: 146, label: 'Sản xuất' },
  { x: 274, label: 'Kho' },
  { x: 402, label: 'Mua hàng' },
  { x: 530, label: 'Chất lượng' },
  { x: 658, label: 'Tài liệu' },
]

/** Coordinates and subtitles copied from the mockup (lane x = 18/146/274/402/530/658; rows y = 30/92/154). */
export const LAYOUT: Record<string, LayoutItem> = {
  'CLM-0012': { x: 18, y: 30, tone: 'bad', sub: 'claim · 02-10' },
  'SHP-1112': { x: 18, y: 92, sub: 'giao C3 · 11-12' },
  'SO-7781': { x: 18, y: 154, sub: 'Customer C3' },
  'MH20-0001': { x: 146, y: 30, tone: 'focus', sub: 'serial · ép 14:05' },
  M02: { x: 146, y: 92, tone: 'bad', sub: 'cycle 31 → 42 s' },
  'HOP-1': { x: 146, y: 154, sub: 'cấp ổ bi · Line 1' },
  'RCV-2810': { x: 274, y: 30, sub: 'nhập kho 10-28 09:10' },
  'LOT-B': { x: 274, y: 92, tone: 'suspect', sub: 'Bearing 6203 · 5,000' },
  'PO-4410': { x: 402, y: 30, sub: 'S1 · 5,000 pcs' },
  'S1-6203-B': { x: 402, y: 92, sub: '≡ LOT-B · alias' },
  'SUP-S1': { x: 402, y: 154, sub: 'ERP: NCC-S1' },
  'IQC-5531': { x: 530, y: 30, tone: 'bad', sub: 'Cpk 0.92 < 1.33' },
  'CLM-0009': { x: 530, y: 92, sub: 'ca tương tự · 09/26' },
  'D-03': { x: 530, y: 154, tone: 'suggested', sub: 'BC lỗi cũ · gợi ý' },
  'D-12': { x: 658, y: 30, sub: 'bản vẽ ổ bi MH-20' },
  'D-09': { x: 658, y: 92, sub: '8D của CLM-0009' },
  'D-07': { x: 658, y: 154, tone: 'pending', sub: 'biên bản 10-29' },
}

/** Which evidence tab a node opens when clicked. */
export const NODE_EVIDENCE: Record<string, 'm02' | 'lot'> = { M02: 'm02', 'LOT-B': 'lot', 'IQC-5531': 'lot' }

export function edgeStyle(status: EdgeStatus): { stroke: string; strokeDasharray?: string } {
  switch (status) {
    case 'inferred': return { stroke: '#0E7C86', strokeDasharray: '5 4' }
    case 'pending': return { stroke: '#0E7C86', strokeDasharray: '2 3' }
    case 'suggested': return { stroke: '#8E959F', strokeDasharray: '1 4' }
    default: return { stroke: '#0E7C86' }
  }
}

export type Side = 'l' | 'r' | 't' | 'b'

/** Pick the connection sides so edges leave toward the neighbouring node. */
export function pickSides(a: LayoutItem, b: LayoutItem): [Side, Side] {
  if (a.x === b.x) return a.y < b.y ? ['b', 't'] : ['t', 'b']
  return a.x < b.x ? ['r', 'l'] : ['l', 'r']
}
