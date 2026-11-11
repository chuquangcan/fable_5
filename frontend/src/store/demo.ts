import { create } from 'zustand'
import { NODE_EVIDENCE } from '../thread/layout'

export type MainTab = 'claim' | 'thread' | 'report'
export type EvidenceTab = 'overview' | 'events' | 'm02' | 'lot' | 'impact'
export type Mode = 'normal' | 'fault'
/** product: one serial's thread (claim-driven) · plant: the plant's assets over time · data: document store + DB. */
export type View = 'product' | 'plant' | 'data'
export type DataTab = 'docs' | 'review' | 'tables'

const isDoc = (id: string) => /^D-/.test(id)

interface DemoState {
  claimId: string | null
  activeTab: MainTab
  openTabs: MainTab[]
  evidenceTab: EvidenceTab
  focusNodeId: string | null
  /** Root serial of the thread on screen (flow.root); the overview's default target when no node is focused. */
  threadRoot: string | null
  mode: Mode
  /** Explicit fault origin picked by the user; null = the claim's own fault point. */
  faultOrigin: string | null
  /** Bumped after a write (fault origin, attachment) so views refetch. */
  dataVersion: number
  /** Node briefly highlighted after an attachment lands on it. */
  flashNodeId: string | null
  attachOpen: boolean
  view: View
  agentOpen: boolean
  /** Document open in the detail drawer. */
  docId: string | null
  /** Asset selected in the plant view. */
  plantAsset: string | null
  dataTab: DataTab
  dataTable: string
  /** Node ids drawn on the current thread (so a jump can stay in the product view). */
  threadIds: string[]
  openClaim: (id: string) => void
  setTab: (t: MainTab) => void
  setEvidence: (t: EvidenceTab) => void
  focusNode: (id: string | null) => void
  setThreadRoot: (id: string | null) => void
  setMode: (m: Mode) => void
  setFaultOrigin: (id: string | null) => void
  selectNode: (id: string) => void
  bumpData: () => void
  flash: (id: string) => void
  openAttach: () => void
  closeAttach: () => void
  reset: () => void
  setView: (v: View) => void
  toggleAgent: () => void
  openDoc: (id: string) => void
  closeDoc: () => void
  selectAsset: (id: string) => void
  setDataTab: (t: DataTab, table?: string) => void
  setThreadIds: (ids: string[]) => void
  /** Open any id where it is best shown: a document in the drawer, a thread node on the thread, anything else in the plant view. */
  goTo: (id: string) => void
  closeTab: (t: MainTab) => void
}

const initial = {
  claimId: null,
  activeTab: 'claim' as MainTab,
  openTabs: [] as MainTab[],
  evidenceTab: 'overview' as EvidenceTab,
  focusNodeId: null,
  threadRoot: null as string | null,
  mode: 'normal' as Mode,
  faultOrigin: null as string | null,
  dataVersion: 0,
  flashNodeId: null as string | null,
  attachOpen: false,
  view: 'product' as View,
  agentOpen: true,
  docId: null as string | null,
  plantAsset: null as string | null,
  dataTab: 'docs' as DataTab,
  dataTable: 'objects',
  threadIds: [] as string[],
}

let flashTimer: ReturnType<typeof setTimeout> | undefined

export const useDemo = create<DemoState>((set, get) => ({
  ...initial,
  openClaim: (id) => set({ claimId: id, openTabs: ['claim', 'thread'], activeTab: 'thread', mode: 'fault', faultOrigin: null, threadRoot: null, view: 'product', focusNodeId: null, evidenceTab: 'overview' }),
  setTab: (t) => set((s) => ({ view: 'product', activeTab: t, openTabs: s.openTabs.includes(t) ? s.openTabs : [...s.openTabs, t] })),
  setEvidence: (t) => set({ evidenceTab: t }),
  focusNode: (id) => set({ focusNodeId: id }),
  setThreadRoot: (id) => set({ threadRoot: id }),
  setMode: (m) => set({ mode: m }),
  setFaultOrigin: (id) => set(id === null ? { faultOrigin: null } : { faultOrigin: id, mode: 'fault' }),
  selectNode: (id) => {
    const ev = NODE_EVIDENCE[id]
    set({ focusNodeId: id, evidenceTab: get().mode === 'fault' && ev ? ev : 'overview' })
  },
  bumpData: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
  flash: (id) => {
    clearTimeout(flashTimer)
    set({ flashNodeId: id })
    flashTimer = setTimeout(() => set({ flashNodeId: null }), 1200)
  },
  openAttach: () => set({ attachOpen: true }),
  closeAttach: () => set({ attachOpen: false }),
  reset: () => {
    clearTimeout(flashTimer)
    set({ ...initial, openTabs: [], threadIds: [] })
  },
  setView: (v) => set({ view: v }),
  toggleAgent: () => set((s) => ({ agentOpen: !s.agentOpen })),
  openDoc: (id) => set({ docId: id }),
  closeDoc: () => set({ docId: null }),
  selectAsset: (id) => set({ view: 'plant', plantAsset: id, evidenceTab: 'overview' }),
  setDataTab: (t, table) => set((s) => ({ view: 'data', dataTab: t, dataTable: table ?? s.dataTable })),
  setThreadIds: (ids) => set({ threadIds: ids }),
  goTo: (id) => {
    const s = get()
    if (isDoc(id)) return s.openDoc(id)
    if (s.claimId && s.threadIds.includes(id)) {
      set({ view: 'product', activeTab: 'thread' })
      return s.selectNode(id)
    }
    s.selectAsset(id)
  },
  closeTab: (t) => set((s) => {
    const openTabs = s.openTabs.filter((x) => x !== t)
    if (openTabs.length === 0) return { openTabs, claimId: null, activeTab: 'claim', focusNodeId: null, threadRoot: null, threadIds: [] }
    return { openTabs, activeTab: s.activeTab === t ? openTabs[openTabs.length - 1] : s.activeTab }
  }),
}))
