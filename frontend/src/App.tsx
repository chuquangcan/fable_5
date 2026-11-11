import { AttachDialog } from './attach/AttachDialog'
import { AgentPanel } from './agent/AgentPanel'
import { ClaimsSidebar } from './claims/ClaimsSidebar'
import { ReportView } from './report/ReportView'
import { AppShell } from './shell/AppShell'
import { useDemo } from './store/demo'
import { ThreadView } from './thread/ThreadView'

const Placeholder = ({ text }: { text: string }) => (
  <div className="mut" style={{ flex: 1, display: 'grid', placeItems: 'center' }}>{text}</div>
)

export default function App() {
  const claimId = useDemo((s) => s.claimId)
  const tab = useDemo((s) => s.activeTab)
  const main = !claimId ? (
    <Placeholder text="Chọn một claim để bắt đầu truy vết" />
  ) : tab === 'thread' ? (
    <ThreadView />
  ) : tab === 'report' ? (
    <ReportView />
  ) : (
    <Placeholder text={`${claimId} · chi tiết claim`} />
  )
  return (
    <>
      <AppShell left={<ClaimsSidebar />} main={main} right={<AgentPanel />} />
      <AttachDialog />
    </>
  )
}
