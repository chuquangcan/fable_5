import type { ReactNode } from 'react'
import { useDemo } from '../store/demo'
import { ActivityBar } from './ActivityBar'
import { Header } from './Header'
import { StatusBar } from './StatusBar'

interface Props {
  left: ReactNode
  main: ReactNode
  right: ReactNode
  /** Accessible name of the left rail (changes with the view). */
  leftLabel?: string
}

/** Command-room layout: header 32 | body (activity 48, left 264, main, agent 340 — collapsible) | status. */
export function AppShell({ left, main, right, leftLabel = 'Claims' }: Props) {
  const agentOpen = useDemo((s) => s.agentOpen)
  return (
    <div className="app">
      <Header />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <ActivityBar />
        <aside aria-label={leftLabel} className="leftrail">{left}</aside>
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>{main}</main>
        {/* kept mounted while hidden so a running answer is not lost */}
        <aside aria-label="AI agent" className="agentrail" hidden={!agentOpen}>{right}</aside>
      </div>
      <StatusBar />
    </div>
  )
}
