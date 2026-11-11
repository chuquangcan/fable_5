import type { NodeSummary } from '../api/types'
import type { EvidenceTab } from '../store/demo'

/** Tabs a node offers, from its summary type: one place instead of a fixed tab set (improve.md §3). */
export function tabsFor(s: NodeSummary): { id: EvidenceTab; label: string }[] {
  const tabs: { id: EvidenceTab; label: string }[] = [{ id: 'overview', label: 'Tổng quan' }]
  if (s.counts.events > 0) tabs.push({ id: 'events', label: `Sự kiện · ${s.counts.events.toLocaleString('en-US')}` })
  if (s.type === 'machine' && s.counts.events > 0) tabs.push({ id: 'machine', label: 'Chu kỳ ép' })
  if (s.type === 'lot' || s.type === 'inspection') tabs.push({ id: 'lot', label: 'IQC · so sánh lô' })
  if (s.type === 'lot' || s.type === 'aggregate') tabs.push({ id: 'impact', label: 'Khoanh vùng' })
  return tabs
}

export const lotOf = (id: string) => id.replace(/^AGG-/, '')
