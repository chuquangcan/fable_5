import type { FlowGraph } from '../api/types'

/** Edges on the shortest (undirected) path from the thread root to `target`, as `up>relation>down` keys. */
export function pathEdges(flow: FlowGraph, target: string | null): Set<string> {
  const out = new Set<string>()
  if (!target || target === flow.root) return out
  const adj = new Map<string, { other: string; key: string }[]>()
  for (const e of flow.edges) {
    const key = `${e.up}>${e.relation}>${e.down}`
    ;(adj.get(e.up) ?? adj.set(e.up, []).get(e.up)!).push({ other: e.down, key })
    ;(adj.get(e.down) ?? adj.set(e.down, []).get(e.down)!).push({ other: e.up, key })
  }
  const prev = new Map<string, { from: string; key: string }>([[flow.root, { from: '', key: '' }]])
  const queue = [flow.root]
  while (queue.length && !prev.has(target)) {
    const n = queue.shift()!
    for (const { other, key } of adj.get(n) ?? []) if (!prev.has(other)) { prev.set(other, { from: n, key }); queue.push(other) }
  }
  for (let n = target; prev.has(n) && n !== flow.root; n = prev.get(n)!.from) out.add(prev.get(n)!.key)
  return out
}
