import type { EdgeStatus } from '../api/types'

export const NODE_W = 104
export const NODE_H = 34

/** Which evidence tab a node opens when clicked (IQC-5531 is an attachment now, but agent cite clicks still use it). */
export const NODE_EVIDENCE: Record<string, 'm02' | 'lot'> = { M02: 'm02', 'LOT-B': 'lot', 'IQC-5531': 'lot' }

export function edgeStyle(status: EdgeStatus): { stroke: string; strokeDasharray?: string } {
  switch (status) {
    case 'inferred': return { stroke: '#0E7C86', strokeDasharray: '5 4' }
    case 'pending': return { stroke: '#0E7C86', strokeDasharray: '2 3' }
    case 'suggested': return { stroke: '#8E959F', strokeDasharray: '1 4' }
    default: return { stroke: '#0E7C86' }
  }
}

/** Normal mode: same dash pattern as edgeStyle, neutral grey stroke. */
export function neutralEdgeStyle(status: EdgeStatus): { stroke: string; strokeDasharray?: string } {
  return { ...edgeStyle(status), stroke: '#8E959F' }
}

/** Fault trace: an edge between two red nodes is the thick red path of the cause chain. */
export function faultEdgeStyle(up?: string, down?: string): { stroke?: string; strokeWidth?: number } {
  return up === 'red' && down === 'red' ? { stroke: '#C62828', strokeWidth: 3 } : {}
}

export type Side = 'l' | 'r' | 't' | 'b'

/** Pick the connection sides so edges leave toward the neighbouring node. */
export function pickSides(a: { x: number; y: number }, b: { x: number; y: number }): [Side, Side] {
  if (a.x === b.x) return a.y < b.y ? ['b', 't'] : ['t', 'b']
  return a.x < b.x ? ['r', 'l'] : ['l', 'r']
}
