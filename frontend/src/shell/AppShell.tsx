import type { ReactNode } from 'react'
import { useDemo } from '../store/demo'
import { ActivityBar } from './ActivityBar'
import { Header } from './Header'
import { Resizer } from './Resizer'
import { StatusBar } from './StatusBar'
import { Workspace } from './Workspace'

const RAIL_LABEL = { feed: 'Notifications & changes', assets: 'Plant assets', data: 'Data repository' } as const

/** Header | activity bar · left rail · workspace (main tabs + dock) · agent rail | status line. Every pane resizes. */
export function AppShell({ left, right }: { left: ReactNode; right: ReactNode }) {
  const agentOpen = useDemo((s) => s.agentOpen)
  const { leftW, agentW, rail } = useDemo((s) => s.layout)
  const setLayout = useDemo((s) => s.setLayout)
  return (
    <div className="app">
      <Header />
      <div className="body">
        <ActivityBar />
        <aside aria-label={RAIL_LABEL[rail]} className="leftrail" style={{ width: leftW }}>{left}</aside>
        <Resizer axis="x" label="Resize left panel" value={leftW} min={200} max={480} onChange={(v) => setLayout({ leftW: v })} />
        <main className="workspace-host"><Workspace /></main>
        {agentOpen && (
          <Resizer axis="x" invert label="Resize agent panel" value={agentW} min={280} max={560} onChange={(v) => setLayout({ agentW: v })} />
        )}
        {/* kept mounted while hidden so a running answer is not lost */}
        <aside aria-label="AI agent" className="agentrail" hidden={!agentOpen} style={{ width: agentW }}>{right}</aside>
      </div>
      <StatusBar />
    </div>
  )
}
