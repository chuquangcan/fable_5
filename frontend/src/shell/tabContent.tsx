import { EvidencePanel } from '../evidence/EvidencePanel'
import type { Tab } from '../store/demo'
import { useDemo } from '../store/demo'
import { ProductTabContext } from '../thread/ProductTabContext'

const Placeholder = ({ text }: { text: string }) => (
  <div className="mut" style={{ flex: 1, display: 'grid', placeItems: 'center' }}>{text}</div>
)

/** What a main-pane tab shows, by kind. Thread tabs are rendered by the workspace itself (kept mounted). */
export function MainContent({ tab }: { tab: Tab | null }) {
  if (!tab) return <Placeholder text="Open a serial, a claim or a document" />
  return <Placeholder text={tab.title} />
}

/** Details of a product tab: the node it focuses (or its serial), in that tab's context. */
function ThreadDetails({ tabId }: { tabId: string }) {
  const node = useDemo((s) => s.product[tabId]?.focusNodeId ?? s.product[tabId]?.root ?? null)
  if (!node) return <Placeholder text="This product tab is closed" />
  return (
    <ProductTabContext.Provider value={tabId}>
      <EvidencePanel nodeId={node} owner={tabId} />
    </ProductTabContext.Provider>
  )
}

/** What a dock tab shows, by kind. */
export function DockContent({ tab }: { tab: Tab | null }) {
  if (!tab) return <Placeholder text="Nothing open in this panel" />
  if (tab.kind === 'thread') return <ThreadDetails tabId={tab.target} />
  if (tab.kind === 'object') return <EvidencePanel nodeId={tab.target} owner={tab.id} />
  return <Placeholder text={tab.title} />
}
