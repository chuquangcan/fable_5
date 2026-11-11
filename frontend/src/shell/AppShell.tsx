import type { ReactNode } from 'react'
import { ActivityBar } from './ActivityBar'
import { Header } from './Header'
import { StatusBar } from './StatusBar'
import { TabBar } from './TabBar'

interface Props {
  left: ReactNode
  main: ReactNode
  right: ReactNode
}

/** Fixed command-room layout: header 32 | body (activity 48, left 264, main, right 340) | status 78. */
export function AppShell({ left, main, right }: Props) {
  return (
    <div
      className="app"
      style={{
        width: '100%', height: '100vh', minWidth: 1280, minHeight: 720, display: 'flex', flexDirection: 'column',
        background: 'var(--app)', color: 'var(--ink)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontSize: 12, overflow: 'hidden',
      }}
    >
      <Header />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <ActivityBar />
        <aside
          aria-label="Claims"
          style={{ width: 264, flex: 'none', background: 'var(--panel)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          {left}
        </aside>
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
          <TabBar />
          {main}
        </main>
        <aside
          aria-label="AI agent"
          style={{ width: 340, flex: 'none', borderLeft: '1px solid var(--line)', background: '#FAFAFB', display: 'flex', flexDirection: 'column' }}
        >
          {right}
        </aside>
      </div>
      <StatusBar />
    </div>
  )
}
