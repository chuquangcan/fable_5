import { create } from 'zustand'

export type MainTab = 'claim' | 'thread' | 'report'
export type EvidenceTab = 'm02' | 'lot' | 'impact'

interface DemoState {
  claimId: string | null
  activeTab: MainTab
  openTabs: MainTab[]
  evidenceTab: EvidenceTab
  focusNodeId: string | null
  openClaim: (id: string) => void
  setTab: (t: MainTab) => void
  setEvidence: (t: EvidenceTab) => void
  focusNode: (id: string | null) => void
  reset: () => void
}

const initial = {
  claimId: null,
  activeTab: 'claim' as MainTab,
  openTabs: [] as MainTab[],
  evidenceTab: 'm02' as EvidenceTab,
  focusNodeId: null,
}

export const useDemo = create<DemoState>((set) => ({
  ...initial,
  openClaim: (id) => set({ claimId: id, openTabs: ['claim', 'thread'], activeTab: 'thread' }),
  setTab: (t) => set((s) => ({ activeTab: t, openTabs: s.openTabs.includes(t) ? s.openTabs : [...s.openTabs, t] })),
  setEvidence: (t) => set({ evidenceTab: t }),
  focusNode: (id) => set({ focusNodeId: id }),
  reset: () => set({ ...initial, openTabs: [] }),
}))
