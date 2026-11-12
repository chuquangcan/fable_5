import { create } from 'zustand'
import { createJSONStorage, persist, type PersistStorage, type StateStorage } from 'zustand/middleware'
import { DEMO_QUESTION, STORY_CLAIM, STORY_LOT, STORY_SERIAL } from '../lib/story'
import { NODE_EVIDENCE } from '../thread/layout'
import { closeIn, type Group, type GroupId, keepIn, moveIn, type NewTab, openIn, type Tab } from './tabs'
import type { FeedItem } from '../api/types'
import { reachOf } from './feedReach'
import { goTo, viewOnThread } from './navigate'

export type { GroupId, Tab, TabKind } from './tabs'
export type EvidenceTab = 'overview' | 'events' | 'machine' | 'lot' | 'impact'
export type Mode = 'normal' | 'fault'
export type Rail = 'feed' | 'assets' | 'data'
export type TwinLayer = 'machines' | 'lots' | 'alerts' | 'flow'
export type FeedFilter = 'all' | 'alert' | '4m' | 'link' | 'doc' | 'claim'
export interface FeedState { selected: string | null; kind: FeedFilter; dept: string | null; read: string[] }
/** Deep-link steps of the demo script: 1 plant + feed · 2 CLM-0012 thread · 3 lot evidence · 4 agent RCA. */
export type Step = 1 | 2 | 3 | 4
export interface AgentCmd { kind: 'none' | 'ask' | 'clear'; question?: string; n: number }

/** State of one product (thread) tab: each tab keeps its own root, focus, fault mode and fault origin. */
export interface ProductTab {
  root: string
  /** Fault colouring and "Set as fault origin" exist only when the tab has a claim. */
  claimId: string | null
  /** Node ids drawn on this tab's thread. */
  threadIds: string[]
  focusNodeId: string | null
  mode: Mode
  /** Explicit fault origin picked by the user; null = the claim's own fault point. */
  faultOrigin: string | null
}

export interface Layout { rail: Rail; leftW: number; agentW: number; dockH: number; dockCollapsed: boolean; split: boolean }

export const DEFAULT_AS_OF = '2026-11-03T14:05:00+07:00'
export const threadTabId = (serial: string) => `thread:${serial}`
export const detailTabId = (threadId: string) => `detail:${threadId}`
const objectTabId = (id: string) => `object:${id}`

const TWIN: Tab = { id: 'twin', kind: 'twin', target: 'plant', title: 'Plant', pinned: true, preview: false }
const OVERVIEW: Tab = { id: 'overview', kind: 'overview', target: 'plant', title: 'Plant overview', pinned: true, preview: false }
const SOURCES: Tab = { id: 'table:sources', kind: 'table', target: 'sources', title: 'Data sources', pinned: false, preview: false }
const REVIEW: Tab = { id: 'review', kind: 'review', target: 'queue', title: 'Review queue', pinned: false, preview: false }

export interface DemoState {
  groups: Record<GroupId, Group>
  product: Record<string, ProductTab>
  /** Evidence sub-tab per owner: a thread tab id (its details tab) or an object tab id. */
  evidence: Record<string, EvidenceTab>
  twin: { selected: string | null; layers: Record<TwinLayer, boolean> }
  /** Bottom tab last shown for each main tab, so switching main tabs restores the dock. */
  dockActive: Record<string, string>
  layout: Layout
  /** The demo clock: the twin and overview show the plant as of this time. */
  asOf: string
  /** Objects highlighted while hovering a feed card. */
  hoverIds: string[]
  /** Reach of the selected feed card on the twin: red (fault trace) and orange (impact). */
  reach: { red: string[]; orange: string[] }
  feed: FeedState
  /** "View on thread" found several product tabs: ask which. */
  picker: { id: string; tabIds: string[] } | null
  /** Bumped after a write (fault origin, attachment, review) so views refetch. */
  dataVersion: number
  /** Node briefly highlighted after an attachment lands on it. */
  flashNodeId: string | null
  attachOpen: boolean
  agentOpen: boolean
  /** Command for the agent panel; `n` changes on every command so the same one can repeat. */
  agentCmd: AgentCmd

  openTab: (g: GroupId, tab: NewTab, opts?: { preview?: boolean; activate?: boolean }) => void
  keepTab: (g: GroupId, id: string) => void
  closeTab: (g: GroupId, id: string) => void
  moveTab: (g: GroupId, fromId: string, toId: string) => void
  activate: (g: GroupId, id: string) => void
  splitDock: (on: boolean) => void
  setLayout: (p: Partial<Layout>) => void
  setRail: (r: Rail) => void
  setAsOf: (at: string) => void
  setHover: (ids: string[]) => void
  setReach: (r: { red: string[]; orange: string[] }) => void
  /** Select a feed card: mark it read, move the clock to it, show its details in the dock and its reach on the twin. */
  selectCard: (item: FeedItem) => Promise<void>
  setFeedFilter: (kind: FeedFilter) => void
  setDept: (dept: string | null) => void
  openProduct: (serial: string, opts?: { claimId?: string }) => string
  openClaim: (claimId: string, serial: string) => void
  openReport: (claimId: string) => void
  openDoc: (id: string) => void
  /** The review queue lives in the dock. */
  openReview: () => void
  /** The data sources table lives in the dock. */
  openSources: () => void
  selectTwin: (id: string | null, title?: string) => void
  toggleLayer: (layer: TwinLayer) => void
  focusNode: (tabId: string, id: string | null) => void
  selectNode: (tabId: string, id: string) => void
  setMode: (tabId: string, m: Mode) => void
  setFaultOrigin: (tabId: string, id: string | null) => void
  setThreadIds: (tabId: string, ids: string[]) => void
  setRoot: (tabId: string, serial: string) => void
  setEvidence: (owner: string, t: EvidenceTab) => void
  /** Open any id where it is best shown (spec §1): documents and serials in main, other objects in the dock. */
  goTo: (id: string) => Promise<void>
  viewOnPlant: (id: string) => void
  viewOnThread: (id: string) => void
  closePicker: () => void
  /** Jump to a step of the demo script; `mode` overrides the step's default colouring. */
  applyStep: (step: Step, mode?: Mode) => void
  reset: () => void
  bumpData: () => void
  flash: (id: string) => void
  openAttach: () => void
  closeAttach: () => void
  toggleAgent: () => void
}

const DEFAULT_LAYERS: Record<TwinLayer, boolean> = { machines: true, lots: false, alerts: true, flow: true }

const initialGroups = (): Record<GroupId, Group> => ({
  main: { tabs: [TWIN], active: 'twin' },
  bottom: { tabs: [OVERVIEW, SOURCES, REVIEW], active: 'overview' },
  bottom2: { tabs: [], active: null },
})

const initial = () => ({
  groups: initialGroups(),
  product: {} as Record<string, ProductTab>,
  evidence: {} as Record<string, EvidenceTab>,
  twin: { selected: null as string | null, layers: DEFAULT_LAYERS },
  dockActive: {} as Record<string, string>,
  layout: { rail: 'feed', leftW: 280, agentW: 340, dockH: 300, dockCollapsed: false, split: false } as Layout,
  asOf: DEFAULT_AS_OF,
  hoverIds: [] as string[],
  reach: { red: [] as string[], orange: [] as string[] },
  feed: { selected: null, kind: 'all', dept: null, read: [] } as FeedState,
  picker: null as DemoState['picker'],
  dataVersion: 0,
  flashNodeId: null as string | null,
  attachOpen: false,
  agentOpen: true,
  agentCmd: { kind: 'none', n: 0 } as AgentCmd,
})

export const activeMain = (s: Pick<DemoState, 'groups'>): Tab | null =>
  s.groups.main.tabs.find((t) => t.id === s.groups.main.active) ?? null

export function activeProduct(s: Pick<DemoState, 'groups' | 'product'>): { tabId: string; p: ProductTab } | null {
  const t = activeMain(s)
  const p = t && t.kind === 'thread' ? s.product[t.id] : undefined
  return t && p ? { tabId: t.id, p } : null
}

/** What the agent is looking at, in words: the product tab on screen, else the selected feed card, else the plant. */
export function agentContext(s: Pick<DemoState, 'groups' | 'product' | 'twin' | 'feed'>): string {
  const prod = activeProduct(s)
  if (prod) {
    const { p } = prod
    return `Thread · ${p.root}${p.claimId ? ` (${p.claimId})` : ''}${p.focusNodeId ? ` › ${p.focusNodeId}` : ''}`
  }
  const main = activeMain(s)
  if (main && main.kind !== 'twin') return main.title
  if (s.feed.selected) return `Feed · ${s.feed.selected}`
  return s.twin.selected ? `Plant › ${s.twin.selected}` : 'Plant'
}

/** Bottom tab a main tab shows by default: the overview for the twin, the details for a product tab. */
function defaultDock(s: Pick<DemoState, 'groups'>, mainId: string | null): string | null {
  const t = s.groups.main.tabs.find((x) => x.id === mainId)
  if (t?.kind === 'twin') return 'overview'
  if (t?.kind === 'thread') return detailTabId(t.id)
  return s.groups.bottom.active
}

/** After the main tab changes: show the bottom tab it last showed (if still open), else its default. */
function followMain(s: Pick<DemoState, 'dockActive'>, groups: Record<GroupId, Group>): Record<GroupId, Group> {
  const main = groups.main.active
  const has = (id: string | null | undefined) => !!id && groups.bottom.tabs.some((t) => t.id === id)
  const remembered = main ? s.dockActive[main] : undefined
  const want = has(remembered) ? remembered! : defaultDock({ groups }, main)
  return has(want) ? { ...groups, bottom: { ...groups.bottom, active: want } } : groups
}

/** Records the bottom tab now showing for the active main tab. */
const remember = (dockActive: Record<string, string>, groups: Record<GroupId, Group>) =>
  groups.main.active && groups.bottom.active ? { ...dockActive, [groups.main.active]: groups.bottom.active } : dockActive

function detailTab(threadId: string, serial: string): NewTab {
  return { id: detailTabId(threadId), kind: 'thread', target: threadId, title: `Details · ${serial}` }
}

/** Open a product tab's details in the dock; when the split group already holds them, they stay there (one place per tab). */
function withDetails(groups: Record<GroupId, Group>, threadId: string, serial: string, activate: boolean): Record<GroupId, Group> {
  const id = detailTabId(threadId)
  if (groups.bottom2.tabs.some((t) => t.id === id))
    return activate ? { ...groups, bottom2: { ...groups.bottom2, active: id } } : groups
  return { ...groups, bottom: openIn(groups.bottom, detailTab(threadId, serial), { activate }) }
}

let flashTimer: ReturnType<typeof setTimeout> | undefined
/** Bumped per selected feed card, so only the latest card's reach is kept. */
let reachToken = 0

/** localStorage that never throws (private windows, blocked storage). */
const safeStorage: StateStorage = {
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* not saved */ } },
  removeItem: (k) => { try { localStorage.removeItem(k) } catch { /* nothing */ } },
}

type Saved = Pick<DemoState, 'groups' | 'product' | 'evidence' | 'twin' | 'dockActive' | 'layout'> & { feed?: Pick<FeedState, 'read'> }
const jsonStorage = createJSONStorage<Saved>(() => safeStorage)!
const storage: PersistStorage<Saved> = {
  getItem: (name) => { try { return jsonStorage.getItem(name) } catch { return null } },  // bad JSON → defaults
  setItem: jsonStorage.setItem,
  removeItem: jsonStorage.removeItem,
}
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isUsable = (p: unknown): p is Saved => {
  if (!isObject(p)) return false
  const { groups: g, product, evidence, dockActive, layout } = p as Saved
  if (!g?.main?.tabs?.some((t) => t.id === 'twin') || !g.bottom?.tabs?.some((t) => t.id === 'overview') || !g.bottom2?.tabs) return false
  if (!isObject(layout) || !isObject(product) || !isObject(evidence) || !isObject(dockActive)) return false
  // every product tab needs its state, or it would wait for a thread forever
  return g.main.tabs.every((t) => t.kind !== 'thread' || (isObject(product[t.id]) && typeof product[t.id].root === 'string'))
}

export const useDemo = create<DemoState>()(persist<DemoState, [], [], Saved>((set, get) => {
  const setGroups = (groups: Record<GroupId, Group>, extra: Partial<DemoState> = {}) =>
    set((s) => ({ groups, dockActive: remember(s.dockActive, groups), ...extra }))
  const withGroup = (g: GroupId, next: Group, base = get().groups) => ({ ...base, [g]: next })
  const patchProduct = (tabId: string, patch: Partial<ProductTab>) =>
    set((s) => (s.product[tabId] ? { product: { ...s.product, [tabId]: { ...s.product[tabId], ...patch } } } : {}))
  const showDetails = (tabId: string) => {
    const p = get().product[tabId]
    if (!p) return
    setGroups(withDetails(get().groups, tabId, p.root, true))
  }

  return {
    ...initial(),

    toggleLayer: (layer) => set((s) => ({ twin: { ...s.twin, layers: { ...s.twin.layers, [layer]: !s.twin.layers[layer] } } })),
    openTab: (g, tab, opts) => {
      let groups = withGroup(g, openIn(get().groups[g], tab, opts))
      if (g === 'main' && opts?.activate !== false) groups = followMain(get(), groups)
      setGroups(groups)
    },
    keepTab: (g, id) => setGroups(withGroup(g, keepIn(get().groups[g], id))),
    closeTab: (g, id) => {
      const s = get()
      const next = closeIn(s.groups[g], id)
      if (next === s.groups[g]) return
      let groups = withGroup(g, next)
      const extra: Partial<DemoState> = {}
      if (g === 'main' && s.product[id]) {
        // a product tab takes its state and its details tab with it
        const { [id]: _p, ...product } = s.product
        const { [id]: _e, ...evidence } = s.evidence
        const { [id]: _d, ...dockActive } = s.dockActive
        extra.product = product
        extra.evidence = evidence
        extra.dockActive = dockActive
        for (const b of ['bottom', 'bottom2'] as const) groups = { ...groups, [b]: closeIn(groups[b], detailTabId(id)) }
      }
      if (g === 'main') groups = followMain({ dockActive: extra.dockActive ?? s.dockActive }, groups)
      if (g === 'bottom' && !groups.bottom.active) groups = followMain(s, groups)
      const split = groups.bottom2.tabs.length > 0 && s.layout.split
      set((st) => ({
        groups, ...extra, dockActive: remember(extra.dockActive ?? st.dockActive, groups),
        layout: split === st.layout.split ? st.layout : { ...st.layout, split },
      }))
    },
    moveTab: (g, fromId, toId) => setGroups(withGroup(g, moveIn(get().groups[g], fromId, toId))),
    activate: (g, id) => {
      const s = get()
      if (!s.groups[g].tabs.some((t) => t.id === id)) return
      let groups = withGroup(g, { ...s.groups[g], active: id })
      if (g === 'main') groups = followMain(s, groups)
      setGroups(groups)
    },
    splitDock: (on) => {
      const s = get()
      if (on === s.layout.split) return
      let { bottom, bottom2 } = s.groups
      if (on) {
        const t = bottom.tabs.find((x) => x.id === bottom.active)
        if (!t || t.pinned) return
        bottom = closeIn(bottom, t.id)
        bottom2 = { tabs: [t], active: t.id }
      } else {
        const here = new Set(bottom.tabs.map((t) => t.id))
        bottom = { ...bottom, tabs: [...bottom.tabs, ...bottom2.tabs.filter((t) => !here.has(t.id))] }
        bottom2 = { tabs: [], active: null }
      }
      set((st) => ({ groups: { ...st.groups, bottom, bottom2 }, layout: { ...st.layout, split: on } }))
    },
    setLayout: (p) => set((s) => ({ layout: { ...s.layout, ...p } })),
    setRail: (rail) => set((s) => ({ layout: { ...s.layout, rail } })),
    setAsOf: (asOf) => set({ asOf }),
    setHover: (hoverIds) => set({ hoverIds }),
    setReach: (reach) => set({ reach }),
    selectCard: async (item) => {
      const token = ++reachToken
      set((s) => ({
        feed: { ...s.feed, selected: item.id, read: s.feed.read.includes(item.id) ? s.feed.read : [...s.feed.read, item.id] },
        asOf: item.at,
      }))
      get().openTab('bottom', { id: `feed:${item.id}`, kind: 'feed', target: item.id, title: `${item.badge} · ${item.id}` }, { preview: true })
      const reach = await reachOf(item)
      if (token === reachToken) set({ reach })  // an older card answering late is dropped
    },
    setFeedFilter: (kind) => set((s) => ({ feed: { ...s.feed, kind } })),
    setDept: (dept) => set((s) => ({ feed: { ...s.feed, dept } })),

    openProduct: (serial, opts = {}) => {
      const id = threadTabId(serial)
      const s = get()
      const cur = s.product[id]
      const claimId = opts.claimId ?? cur?.claimId ?? null
      const fresh = !cur || (opts.claimId && opts.claimId !== cur.claimId)
      const p: ProductTab = fresh
        ? { root: serial, claimId, threadIds: cur?.threadIds ?? [], focusNodeId: null, mode: claimId ? 'fault' : 'normal', faultOrigin: null }
        : cur
      let groups = withGroup('main', openIn(s.groups.main, { id, kind: 'thread', target: serial, title: `Thread · ${serial}` }))
      groups = withDetails(groups, id, serial, false)
      groups = followMain(s, groups)
      setGroups(groups, { product: { ...s.product, [id]: p }, ...(fresh ? { evidence: { ...s.evidence, [id]: 'overview' } } : {}) })
      return id
    },
    openClaim: (claimId, serial) => { get().openProduct(serial, { claimId }) },
    openReport: (claimId) => get().openTab('main', { id: `report:${claimId}`, kind: 'report', target: claimId, title: `RCA report · ${claimId}` }),
    openReview: () => get().openTab('bottom', REVIEW),
    openSources: () => get().openTab('bottom', SOURCES),
    openDoc: (id) => get().openTab('main', { id: `doc:${id}`, kind: 'doc', target: id, title: id }, { preview: true }),
    selectTwin: (id, title) => {
      if (id === null) {
        set((s) => ({ twin: { ...s.twin, selected: null } }))
        return get().activate('bottom', 'overview')
      }
      set((s) => ({ twin: { ...s.twin, selected: id } }))
      get().openTab('bottom', { id: objectTabId(id), kind: 'object', target: id, title: title ?? id }, { preview: true })
    },

    focusNode: (tabId, id) => patchProduct(tabId, { focusNodeId: id }),
    selectNode: (tabId, id) => {
      const p = get().product[tabId]
      if (!p) return
      const ev = NODE_EVIDENCE[id]
      set((s) => ({ evidence: { ...s.evidence, [tabId]: p.mode === 'fault' && ev ? ev : 'overview' } }))
      patchProduct(tabId, { focusNodeId: id })
      showDetails(tabId)
    },
    setMode: (tabId, mode) => { if (get().product[tabId]?.claimId) patchProduct(tabId, { mode }) },
    setFaultOrigin: (tabId, id) => {
      if (!get().product[tabId]?.claimId) return
      patchProduct(tabId, id === null ? { faultOrigin: null } : { faultOrigin: id, mode: 'fault' })
    },
    setThreadIds: (tabId, threadIds) => patchProduct(tabId, { threadIds }),
    setRoot: (tabId, root) => patchProduct(tabId, { root }),
    setEvidence: (owner, t) => set((s) => ({ evidence: { ...s.evidence, [owner]: t } })),

    goTo: (id) => goTo(get, id),
    viewOnPlant: (id) => {
      get().activate('main', 'twin')
      get().selectTwin(id)
    },
    viewOnThread: (id) => viewOnThread(get, set, id),
    closePicker: () => set({ picker: null }),

    applyStep: (step, mode) => {
      const s = get()
      s.reset()
      if (step >= 2) s.openClaim(STORY_CLAIM, STORY_SERIAL)
      const tab = threadTabId(STORY_SERIAL)
      if (step >= 3) {
        s.selectNode(tab, STORY_LOT)
        s.setEvidence(tab, 'lot')
      }
      if (step >= 4) set((st) => ({ agentCmd: { kind: 'ask', question: DEMO_QUESTION, n: st.agentCmd.n + 1 } }))
      if (mode && step >= 2) patchProduct(tab, { mode })
    },
    reset: () => {
      clearTimeout(flashTimer)
      set((s) => ({ ...initial(), agentOpen: s.agentOpen, agentCmd: { kind: 'clear', n: s.agentCmd.n + 1 } }))
    },
    bumpData: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
    flash: (id) => {
      clearTimeout(flashTimer)
      set({ flashNodeId: id })
      flashTimer = setTimeout(() => set({ flashNodeId: null }), 1200)
    },
    openAttach: () => set({ attachOpen: true }),
    closeAttach: () => set({ attachOpen: false }),
    toggleAgent: () => set((s) => ({ agentOpen: !s.agentOpen })),
  }
}, {
  name: 'onethread.workspace',
  version: 1,
  storage,
  partialize: (s): Saved => ({
    groups: s.groups, product: s.product, evidence: s.evidence, twin: s.twin, dockActive: s.dockActive, layout: s.layout,
    feed: { read: s.feed.read },
  }),
  migrate: () => ({}) as Saved,  // an older shape is dropped: the defaults are a better start than a half-valid workspace
  merge: (saved, current) => {
    if (!isUsable(saved)) return current
    const read = Array.isArray(saved.feed?.read) ? saved.feed.read.filter((r) => typeof r === 'string') : []
    const twin = { ...current.twin, ...saved.twin, layers: { ...DEFAULT_LAYERS, ...saved.twin?.layers } }  // saves from before layers existed
    const { asOf: _clock, ...rest } = saved as Saved & { asOf?: unknown }  // older saves carried the clock; a reload starts at the demo time
    return { ...current, ...rest, twin, feed: { ...current.feed, read } }
  },
}))
