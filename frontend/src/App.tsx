import { useEffect } from 'react'
import { AttachDialog } from './attach/AttachDialog'
import { AgentPanel } from './agent/AgentPanel'
import { DataSidebar } from './data/DataView'
import { PlantSidebar } from './plant/PlantSidebar'
import { AppShell } from './shell/AppShell'
import { parseDeepLink } from './lib/deepLink'
import { useDemo } from './store/demo'

function LeftRail() {
  const rail = useDemo((s) => s.layout.rail)
  if (rail === 'assets') return <PlantSidebar />
  if (rail === 'data') return <DataSidebar />
  return <div className="side-title">Notifications & changes</div>
}

export default function App() {
  useEffect(() => {
    // a deep link (?step=) rebuilds that step's tabs; otherwise the saved workspace reopens as it was
    const link = parseDeepLink(window.location.search)
    if (link) useDemo.getState().applyStep(link.step, link.mode)
  }, [])
  return (
    <>
      <AppShell left={<LeftRail />} right={<AgentPanel />} />
      <AttachDialog />
    </>
  )
}
