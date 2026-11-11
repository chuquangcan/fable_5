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
  mode: Mode
  /** Explicit fault origin picked by the user; null = the claim's own fault point. */
  faultOrigin: string | null
  /** Bumped after a write (fault origin, attachment) so views refetch. */
  dataVersion: number
  openClaim: (id: string) => void
  setTab: (t: MainTab) => void
  setEvidence: (t: EvidenceTab) => void
  focusNode: (id: string | null) => void
  setMode: (m: Mode) => void
  setFaultOrigin: (id: string | null) => void
  selectNode: (id: string) => void
  bumpData: () => void
  reset: () => void
}

const initial = {
  claimId: null,
  activeTab: 'claim' as MainTab,
  openTabs: [] as MainTab[],
  evidenceTab: 'm02' as EvidenceTab,
  focusNodeId: null,
  mode: 'normal' as Mode,
  faultOrigin: null as string | null,
  dataVersion: 0,
}

export const useDemo = create<DemoState>((set, get) => ({
  ...initial,
  openClaim: (id) => set({ claimId: id, openTabs: ['claim', 'thread'], activeTab: 'thread', mode: 'fault', faultOrigin: null }),
  setTab: (t) => set((s) => ({ activeTab: t, openTabs: s.openTabs.includes(t) ? s.openTabs : [...s.openTabs, t] })),
  setEvidence: (t) => set({ evidenceTab: t }),
  focusNode: (id) => set({ focusNodeId: id }),
  setMode: (m) => set({ mode: m }),
  setFaultOrigin: (id) => set(id === null ? { faultOrigin: null } : { faultOrigin: id, mode: 'fault' }),
  selectNode: (id) => {
    const ev = NODE_EVIDENCE[id]
    set({ focusNodeId: id, evidenceTab: get().mode === 'fault' && ev ? ev : 'overview' })
  },
  bumpData: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
  reset: () => set({ ...initial, openTabs: [] }),
}))
