/** Tab groups of the workspace (main pane, bottom dock): pure, immutable operations, VS Code semantics. */

export type TabKind = 'twin' | 'thread' | 'claim' | 'report' | 'doc' | 'object' | 'overview' | 'review' | 'table' | 'feed'

export interface Tab {
  id: string
  kind: TabKind
  /** What the tab shows: a serial, a claim, a document, an object, a table name, a feed item id. */
  target: string
  title: string
  /** Pinned tabs have no close button and cannot be closed. */
  pinned: boolean
  /** A preview tab (italic) is reused by the next single-click open in the same group. */
  preview: boolean
}

export type GroupId = 'main' | 'bottom' | 'bottom2'

export interface Group {
  tabs: Tab[]
  active: string | null
}

export type NewTab = Omit<Tab, 'preview' | 'pinned'> & Partial<Pick<Tab, 'pinned'>>

export function openIn(g: Group, tab: NewTab, opts: { preview?: boolean; activate?: boolean } = {}): Group {
  const preview = !!opts.preview
  const active = opts.activate === false ? g.active : tab.id
  const i = g.tabs.findIndex((t) => t.id === tab.id)
  if (i >= 0) {
    const cur = g.tabs[i]
    // a permanent open keeps a preview tab; a preview open of the same tab changes nothing
    const tabs = cur.preview && !preview ? g.tabs.map((t, j) => (j === i ? { ...t, preview: false } : t)) : g.tabs
    return { tabs, active }
  }
  const next: Tab = { ...tab, pinned: !!tab.pinned, preview }
  const old = preview ? g.tabs.findIndex((t) => t.preview) : -1
  const tabs = old >= 0 ? g.tabs.map((t, j) => (j === old ? next : t)) : [...g.tabs, next]
  return { tabs, active }
}

export function keepIn(g: Group, id: string): Group {
  if (!g.tabs.some((t) => t.id === id && t.preview)) return g
  return { ...g, tabs: g.tabs.map((t) => (t.id === id ? { ...t, preview: false } : t)) }
}

export function closeIn(g: Group, id: string): Group {
  const i = g.tabs.findIndex((t) => t.id === id)
  if (i < 0 || g.tabs[i].pinned) return g
  const tabs = g.tabs.filter((t) => t.id !== id)
  if (g.active !== id) return { tabs, active: g.active }
  const next = tabs[i] ?? tabs[i - 1] ?? null
  return { tabs, active: next ? next.id : null }
}

export function moveIn(g: Group, fromId: string, toId: string): Group {
  const from = g.tabs.findIndex((t) => t.id === fromId)
  const to = g.tabs.findIndex((t) => t.id === toId)
  if (from < 0 || to < 0 || from === to) return g
  const tabs = [...g.tabs]
  const [moved] = tabs.splice(from, 1)
  tabs.splice(to, 0, moved)
  return { ...g, tabs }
}
