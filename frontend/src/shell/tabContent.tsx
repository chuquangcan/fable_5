import type { Tab } from '../store/demo'

const Placeholder = ({ text }: { text: string }) => (
  <div className="mut" style={{ flex: 1, display: 'grid', placeItems: 'center' }}>{text}</div>
)

/** What a main-pane tab shows, by kind. */
export function MainContent({ tab }: { tab: Tab | null }) {
  if (!tab) return <Placeholder text="Open a serial, a claim or a document" />
  return <Placeholder text={tab.title} />
}

/** What a dock tab shows, by kind. */
export function DockContent({ tab }: { tab: Tab | null }) {
  if (!tab) return <Placeholder text="Nothing open in this panel" />
  return <Placeholder text={tab.title} />
}
