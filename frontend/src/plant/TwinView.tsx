import '@xyflow/react/dist/style.css'
import { type Edge, type Node, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getPlant, getPlantState } from '../api/client'
import type { FeedItem, PlantArea, PlantState } from '../api/types'
import { Pending, useAsync } from '../evidence/useAsync'
import { unreadBySender, useFeed } from '../feed/useFeed'
import { type TwinLayer, useDemo } from '../store/demo'
import { edgeStyle } from '../thread/layout'
import { LinkLegend } from '../thread/LinkLegend'
import { DeptStrip } from './DeptStrip'
import { SerialPicker } from './SerialPicker'
import { TwinNode, type TwinNodeProps } from './TwinNode'
import { COLUMN_LABELS, TWIN_COL_X, TWIN_NODE_H, TWIN_NODE_W, type TwinNodeData, twinLayout } from './twinLayout'

/** Column heading inside the flow, so it pans and zooms with the nodes. */
const ColumnLabel = ({ data }: { data: { text: string } }) => <span className="twin-col">{data.text}</span>
const nodeTypes = { twin: TwinNode, label: ColumnLabel }
const LABELS: Node[] = COLUMN_LABELS.map((text, i) => ({
  id: `label-${i}`, type: 'label', position: { x: TWIN_COL_X[i], y: 8 }, data: { text }, selectable: false, focusable: false,
}))
const LAYERS: { id: TwinLayer; label: string }[] = [
  { id: 'machines', label: 'Machines' }, { id: 'lots', label: 'Lots in use' }, { id: 'alerts', label: 'Alerts' }, { id: 'flow', label: 'Department flow' },
]
const title = (n: TwinNodeData) => (n.line ? `${n.line} › ${n.name}` : n.name)

/** Edge sides from the two nodes' columns: rightwards, leftwards, or down within a column. */
function sides(a: TwinNodeData, b: TwinNodeData): [string, string] {
  if (a.x < b.x) return ['s-r', 't-l']
  if (a.x > b.x) return ['s-l', 't-r']
  return a.y < b.y ? ['s-b', 't-t'] : ['s-t', 't-b']
}

/** "View on thread" found several product tabs: ask which. */
function TabPicker() {
  const picker = useDemo((s) => s.picker)
  const product = useDemo((s) => s.product)
  if (!picker) return null
  const choose = (tabId: string) => {
    const s = useDemo.getState()
    s.activate('main', tabId)
    s.selectNode(tabId, picker.id)
    s.closePicker()
  }
  return (
    <div role="menu" aria-label={`Open ${picker.id} in which product tab?`} className="twin-pop">
      <div className="twin-pop-head"><span style={{ fontWeight: 600 }}>{`Open ${picker.id} in…`}</span><span style={{ flex: 1 }} />
        <button className="btn" aria-label="Close" onClick={() => useDemo.getState().closePicker()}>✕</button>
      </div>
      <div className="twin-pop-list">
        {picker.tabIds.map((t) => <button key={t} role="menuitem" className="linkish mono" onClick={() => choose(t)}>{product[t]?.root ?? t}</button>)}
      </div>
    </div>
  )
}

interface Line { dept: string; id: string; x1: number; y1: number; x2: number; y2: number }

function Canvas({ plant, state, feed }: { plant: PlantArea[]; state: PlantState; feed: FeedItem[] }) {
  const layers = useDemo((s) => s.twin.layers)
  const selected = useDemo((s) => s.twin.selected)
  const dept = useDemo((s) => s.feed.dept)
  const read = useDemo((s) => s.feed.read)
  const { selectTwin, toggleLayer, viewOnThread } = useDemo.getState()
  const rf = useReactFlow()
  const [serialsOf, setSerialsOf] = useState<string | null>(null)
  const closeSerials = useCallback(() => setSerialsOf(null), [setSerialsOf])

  const layout = useMemo(() => twinLayout(plant, state), [plant, state])
  const unread = useMemo(() => unreadBySender(feed, read), [feed, read])
  const deptIds = useMemo(() => new Set(dept ? feed.filter((i) => i.sender === dept).flatMap((i) => i.objects) : []), [feed, dept])
  const visible = useMemo(() => {
    const fed = new Set(state.edges.filter((e) => e.relation === 'fed_into').map((e) => e.from_id))
    return layout.nodes.filter((n) =>
      (layers.machines || n.type !== 'machine')
      && (!layers.lots || n.type !== 'lot' || fed.has(n.id) || (state.nodes[n.id]?.state ?? 'idle') !== 'idle'))
  }, [layout, layers, state])

  const { nodes, edges } = useMemo(() => {
    const pos = new Map(visible.map((n) => [n.id, n]))
    const nodes: Node[] = [...LABELS, ...visible.map((n): Node<TwinNodeProps> => ({
      id: n.id, type: 'twin', position: { x: n.x, y: n.y }, width: TWIN_NODE_W, height: TWIN_NODE_H, initialWidth: TWIN_NODE_W, initialHeight: TWIN_NODE_H,
      data: { n, st: state.nodes[n.id], alerts: layers.alerts, deptHl: deptIds.has(n.id) },
    }))]
    const edges: Edge[] = layout.edges.filter((e) => pos.has(e.from_id) && pos.has(e.to_id)).map((e) => {
      const [sourceHandle, targetHandle] = sides(pos.get(e.from_id)!, pos.get(e.to_id)!)
      return {
        id: `${e.from_id}>${e.relation}>${e.to_id}`, source: e.from_id, target: e.to_id, sourceHandle, targetHandle,
        type: 'smoothstep', style: { strokeWidth: 1.5, ...edgeStyle(e.status) },
      }
    })
    return { nodes, edges }
  }, [visible, layout, state, layers, deptIds])

  // Department flow: a dotted line from each chip to the objects of its unread items, measured after paint.
  const frame = useRef<HTMLDivElement>(null)
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [lines, setLines] = useState<Line[]>([])
  const [moved, setMoved] = useState(0)
  useLayoutEffect(() => {
    const measure = () => {
      const box = frame.current?.getBoundingClientRect()
      if (!box || !layers.flow) return setLines([])
      const out: Line[] = []
      for (const [d, its] of Object.entries(unread)) {
        const chip = chipRefs.current[d]?.getBoundingClientRect()
        if (!chip) continue
        for (const id of new Set(its.flatMap((i) => i.objects))) {
          const el = frame.current?.querySelector(`[data-testid="twin-${CSS.escape(id)}"]`)
          if (!el) continue
          const r = el.getBoundingClientRect()
          out.push({ dept: d, id, x1: chip.left + chip.width / 2 - box.left, y1: chip.bottom - box.top, x2: r.left + r.width / 2 - box.left, y2: r.top - box.top })
        }
      }
      setLines(out)
    }
    const raf = requestAnimationFrame(measure)
    const ro = new ResizeObserver(measure)
    if (frame.current) ro.observe(frame.current)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [unread, layers.flow, nodes, moved])

  return (
    <div ref={frame} className="twin">
      <DeptStrip unread={unread} chipRefs={chipRefs} />
      <div className="twin-toolbar" role="toolbar" aria-label="Twin">
        {LAYERS.map((l) => (
          <button key={l.id} className={`fchip${layers[l.id] ? ' on' : ''}`} aria-pressed={layers[l.id]} onClick={() => toggleLayer(l.id)}>{l.label}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button className="btn" aria-label="Zoom out" onClick={() => void rf.zoomOut()}>−</button>
        <button className="btn" aria-label="Zoom in" onClick={() => void rf.zoomIn()}>+</button>
        <button className="btn" onClick={() => void rf.fitView()}>Fit to frame</button>
        <button className="btn" disabled={!selected} onClick={() => selected && viewOnThread(selected)}>View on thread</button>
      </div>
      <div className="twin-canvas">
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.3} maxZoom={2}
          onNodeClick={(_, n) => { if (n.type === 'twin' && n.id !== 'VOL') selectTwin(n.id, title((n.data as TwinNodeProps).n)) }}
          onNodeDoubleClick={(_, n) => { const t = n.type === 'twin' && (n.data as TwinNodeProps).n.type; if (t === 'volume' || t === 'shipment') setSerialsOf(n.id) }}
          onPaneClick={() => selectTwin(null)} onInit={() => setMoved((m) => m + 1)} onMoveEnd={() => setMoved((m) => m + 1)}
          nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        />
        <div className="twin-legend"><LinkLegend /></div>
      </div>
      {layers.flow && (
        <svg className="twin-flow" aria-hidden="true">
          {lines.map((l) => (
            <path key={`${l.dept}-${l.id}`} data-flow={l.dept} d={`M${l.x1},${l.y1} C${l.x1},${(l.y1 + l.y2) / 2} ${l.x2},${(l.y1 + l.y2) / 2} ${l.x2},${l.y2}`}
              style={{ stroke: `var(--dept-${l.dept})` }} />
          ))}
        </svg>
      )}
      {serialsOf && <SerialPicker source={serialsOf} onClose={closeSerials} />}
      <TabPicker />
    </div>
  )
}

/** The pinned "Plant" tab: the plant as of the demo clock, with department chips, layers and the feed's reach. */
export function TwinView() {
  const asOf = useDemo((s) => s.asOf)
  const dataVersion = useDemo((s) => s.dataVersion)
  const data = useAsync(() => Promise.all([getPlant(), getPlantState(asOf)]), [asOf, dataVersion])
  const feed = useFeed()
  if (data.status !== 'ok') return <Pending state={data} />
  return (
    <ReactFlowProvider>
      <Canvas plant={data.data[0]} state={data.data[1]} feed={feed.status === 'ok' ? feed.data : []} />
    </ReactFlowProvider>
  )
}
