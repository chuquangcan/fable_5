import { AttachDialog } from './attach/AttachDialog'
import { AgentPanel } from './agent/AgentPanel'
import { ClaimsSidebar } from './claims/ClaimsSidebar'
import { DataSidebar, DataView } from './data/DataView'
import { DocDrawer } from './docs/DocDrawer'
import { OverviewTab } from './evidence/OverviewTab'
import { PlantSidebar } from './plant/PlantSidebar'
import { PlantView } from './plant/PlantView'
import { ReportView } from './report/ReportView'
import { AppShell } from './shell/AppShell'
import { TabBar } from './shell/TabBar'
import { useDemo } from './store/demo'
import { ThreadView } from './thread/ThreadView'

const Placeholder = ({ text }: { text: string }) => (
  <div className="mut" style={{ flex: 1, display: 'grid', placeItems: 'center' }}>{text}</div>
)

function ProductMain() {
  const claimId = useDemo((s) => s.claimId)
  const tab = useDemo((s) => s.activeTab)
  return (
    <>
      <TabBar />
      {!claimId ? <Placeholder text="Chọn một claim ở cột trái để bắt đầu truy vết" />
        : tab === 'thread' ? <ThreadView />
        : tab === 'report' ? <ReportView />
        : <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}><OverviewTab id={claimId} /></div>}
    </>
  )
}

export default function App() {
  const view = useDemo((s) => s.view)
  const left = view === 'plant' ? <PlantSidebar /> : view === 'data' ? <DataSidebar /> : <ClaimsSidebar />
  const main = view === 'plant' ? <PlantView /> : view === 'data' ? <DataView /> : <ProductMain />
  const leftLabel = view === 'plant' ? 'Tài sản nhà máy' : view === 'data' ? 'Kho dữ liệu' : 'Claims'
  return (
    <>
      <AppShell left={left} main={main} right={<AgentPanel />} leftLabel={leftLabel} />
      <DocDrawer />
      <AttachDialog />
    </>
  )
}
