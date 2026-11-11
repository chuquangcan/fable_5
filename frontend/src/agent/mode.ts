import { create } from 'zustand'

/** Presenter override: Alt+Shift+D forces the server to replay the recorded run instead of calling Claude. */
export const useAgentMode = create<{ replay: boolean; toggle: () => void }>((set) => ({
  replay: false,
  toggle: () => set((s) => ({ replay: !s.replay })),
}))
