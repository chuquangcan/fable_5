import { ClaimsSidebar } from './claims/ClaimsSidebar'
import { AppShell } from './shell/AppShell'
import { useDemo } from './store/demo'

export default function App() {
  const claimId = useDemo((s) => s.claimId)
  const main = claimId ? (
    <div style={{ padding: 16 }}>One Thread</div>
  ) : (
    <div className="mut" style={{ flex: 1, display: 'grid', placeItems: 'center' }}>Chọn một claim để bắt đầu truy vết</div>
  )
  return <AppShell left={<ClaimsSidebar />} main={main} right={null} />
}
