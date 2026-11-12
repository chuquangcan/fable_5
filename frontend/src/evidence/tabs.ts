import type { NodeSummary } from '../api/types'
import type { EvidenceTab } from '../store/demo'

/** Tabs a node offers, from its summary type: one place instead of a fixed tab set (improve.md §3). */
export function tabsFor(s: NodeSummary): { id: EvidenceTab; label: string }[] {
  const tabs: { id: EvidenceTab; label: string }[] = []
  // a machine with cycles opens on its press cycle (spec: dock for a machine shows the cycle first)
  if (s.type === 'machine' && s.counts.events > 0) tabs.push({ id: 'machine', label: 'Press cycle' })
  tabs.push({ id: 'overview', label: 'Overview' })
  if (s.counts.events > 0) tabs.push({ id: 'events', label: `Events · ${s.counts.events.toLocaleString('en-US')}` })
  if (s.type === 'lot' || s.type === 'inspection') tabs.push({ id: 'lot', label: 'IQC · lot comparison' })
  if (s.type === 'lot' || s.type === 'aggregate') tabs.push({ id: 'impact', label: 'Impact scope' })
  return tabs
}

export const lotOf = (id: string) => id.replace(/^AGG-/, '')
