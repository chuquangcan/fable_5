import { create } from 'zustand'
import { NODE_EVIDENCE } from '../thread/layout'

export type MainTab = 'claim' | 'thread' | 'report'
export type EvidenceTab = 'overview' | 'm02' | 'lot' | 'impact'
export type Mode = 'normal' | 'fault'

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
}

const initial = {
  claimId: null,
  activeTab: 'claim' as MainTab,
  openTabs: [] as MainTab[],
  evidenceTab: 'm02' as EvidenceTab,
  focusNodeId: null,
  threadRoot: null as string | null,
  mode: 'normal' as Mode,
  faultOrigin: null as string | null,
  dataVersion: 0,
  flashNodeId: null as string | null,
  attachOpen: false,
}

let flashTimer: ReturnType<typeof setTimeout> | undefined

export const useDemo = create<DemoState>((set, get) => ({
  ...initial,
  openClaim: (id) => set({ claimId: id, openTabs: ['claim', 'thread'], activeTab: 'thread', mode: 'fault', faultOrigin: null, threadRoot: null }),
  setTab: (t) => set((s) => ({ activeTab: t, openTabs: s.openTabs.includes(t) ? s.openTabs : [...s.openTabs, t] })),
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
    set({ ...initial, openTabs: [] })
  },
}))
