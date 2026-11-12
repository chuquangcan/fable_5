import { type GroupId, useDemo } from '../store/demo'

/** Tab id being dragged (HTML5 drag data is not readable on dragover, and jsdom has no DataTransfer). */
let dragging: { group: GroupId; id: string } | null = null

/** One tab bar for every group: ✕ to close, middle-click closes, drag to reorder, double-click keeps a preview. */
export function TabBar({ group }: { group: GroupId }) {
  const g = useDemo((s) => s.groups[group])
  const activate = useDemo((s) => s.activate)
  const closeTab = useDemo((s) => s.closeTab)
  const keepTab = useDemo((s) => s.keepTab)
  const moveTab = useDemo((s) => s.moveTab)
  const collapsed = useDemo((s) => s.layout.dockCollapsed)
  const split = useDemo((s) => s.layout.split)
  return (
    <div className={`tabbar tabbar-${group}`}>
      <div role="tablist" aria-label={group === 'main' ? 'Open tabs' : 'Panel tabs'} className="tabs">
        {g.tabs.map((t) => (
          <div
            key={t.id} className={`tab${t.id === g.active ? ' on' : ''}${t.preview ? ' preview' : ''}`}
            onDragOver={(e) => { if (dragging?.group === group) e.preventDefault() }}
            onDrop={(e) => {
              e.preventDefault()
              if (dragging?.group === group) moveTab(group, dragging.id, t.id)
              dragging = null
            }}
          >
            <button
              role="tab" aria-selected={t.id === g.active} className="tab-btn" title={t.title} draggable
              onClick={() => activate(group, t.id)} onDoubleClick={() => keepTab(group, t.id)}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); closeTab(group, t.id) } }}
              onDragStart={(e) => { dragging = { group, id: t.id }; e.dataTransfer?.setData('text/plain', t.id) }}
              onDragEnd={() => { dragging = null }}
            >
              {t.kind === 'thread' && group === 'main' && <span className="tab-dot" />}
              <span className="ellipsis">{t.title}</span>
            </button>
            {!t.pinned && <button className="xbtn" aria-label={`Close ${t.title}`} onClick={() => closeTab(group, t.id)}>✕</button>}
          </div>
        ))}
      </div>
      {group === 'bottom' && (
        <div className="tabbar-actions">
          <button
            className="xbtn" aria-label={split ? 'Join panels' : 'Split panel'} title={split ? 'Join the two panel groups' : 'Move this tab to a second group'}
            onClick={() => useDemo.getState().splitDock(!split)}
          >◫</button>
          <button
            className="xbtn" aria-label={collapsed ? 'Restore panel' : 'Collapse panel'}
            onClick={() => useDemo.getState().setLayout({ dockCollapsed: !collapsed })}
          >{collapsed ? '▴' : '▾'}</button>
        </div>
      )}
    </div>
  )
}
