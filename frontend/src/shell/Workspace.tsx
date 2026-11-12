import { type GroupId, useDemo } from '../store/demo'
import { Resizer } from './Resizer'
import { DockContent, MainContent } from './tabContent'
import { TabBar } from './TabBar'

const DOCK_MIN = 120
const dockMax = () => Math.max(DOCK_MIN, (typeof window !== 'undefined' ? window.innerHeight : 900) - 200)

function DockGroup({ group }: { group: GroupId }) {
  const tab = useDemo((s) => s.groups[group].tabs.find((t) => t.id === s.groups[group].active) ?? null)
  return (
    <div className="dock-group">
      <TabBar group={group} />
      <div className="pane">{<DockContent tab={tab} />}</div>
    </div>
  )
}

/** Main tab group on top, the bottom dock under it (resizable, collapsible, splittable). */
export function Workspace() {
  const main = useDemo((s) => s.groups.main.tabs.find((t) => t.id === s.groups.main.active) ?? null)
  const { dockH, dockCollapsed, split } = useDemo((s) => s.layout)
  const setLayout = useDemo((s) => s.setLayout)
  return (
    <div className="workspace">
      <section aria-label="Editor" className="main-group">
        <TabBar group="main" />
        <div className="pane">
          <MainContent tab={main} />
        </div>
      </section>
      <Resizer
        axis="y" invert label="Resize panel" value={dockH} min={DOCK_MIN} max={dockMax()}
        onChange={(v) => setLayout({ dockH: v, dockCollapsed: false })} onToggle={() => setLayout({ dockCollapsed: !dockCollapsed })}
      />
      <section aria-label="Panel" className="dock" style={{ height: dockCollapsed ? undefined : dockH }}>
        {dockCollapsed ? <TabBar group="bottom" /> : (
          <>
            <DockGroup group="bottom" />
            {split && <DockGroup group="bottom2" />}
          </>
        )}
      </section>
    </div>
  )
}
