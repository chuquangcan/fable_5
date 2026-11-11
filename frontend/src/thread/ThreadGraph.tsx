import '@xyflow/react/dist/style.css'
import { Handle, type Node, type NodeProps, Position, ReactFlow, type Edge as RFEdge } from '@xyflow/react'
import { useMemo } from 'react'
import type { TraceGraph, TraceNode } from '../api/types'
import { useDemo } from '../store/demo'
import { edgeStyle, LANES, LAYOUT, NODE_EVIDENCE, NODE_H, NODE_W, pickSides, type Side, type Tone } from './layout'

const TONES: Record<Tone, { border: string; bg?: string; ink?: string }> = {
  focus: { border: '2px solid #1C2026' },
  bad: { border: '2px solid #C62828', bg: '#FDECEC', ink: '#A61B1B' },
  suspect: { border: '2px solid #E3BC72', bg: '#FFF4E5', ink: '#7A4300' },
  pending: { border: '2px dotted #0E7C86' },
  suggested: { border: '1px dotted #8E959F', bg: '#F7F8F9' },
}

const POS: Record<Side, Position> = { l: Position.Left, r: Position.Right, t: Position.Top, b: Position.Bottom }
const NAMED_TYPES = new Set(['machine', 'hopper', 'supplier', 'customer'])

function title(n: TraceNode): string {
  if (NAMED_TYPES.has(n.type)) return n.name
  const page = n.type === 'document' ? Number(/p\.(\d+)/.exec(n.name)?.[1]) : 0
  return page > 1 ? `${n.id} · p.${page}` : n.id
}

interface GraphNodeData extends Record<string, unknown> { node: TraceNode; sub: string; tone?: Tone }

function GraphNode({ data }: NodeProps<Node<GraphNodeData>>) {
  const { node, sub, tone } = data
  const focused = useDemo((s) => s.focusNodeId === node.id)
  const t = tone ? TONES[tone] : undefined
  return (
    <button
      className="gn"
      style={{
        position: 'relative', padding: '2px 4px', whiteSpace: 'nowrap', overflow: 'hidden', ...(t ? { border: t.border, background: t.bg } : {}),
        ...(focused ? { outline: '2px solid #0E7C86', outlineOffset: 1 } : {}),
      }}
    >
      {(['l', 'r', 't', 'b'] as Side[]).map((s) => (
        <span key={s}>
          <Handle id={`s-${s}`} type="source" position={POS[s]} style={{ opacity: 0, pointerEvents: 'none' }} isConnectable={false} />
          <Handle id={`t-${s}`} type="target" position={POS[s]} style={{ opacity: 0, pointerEvents: 'none' }} isConnectable={false} />
        </span>
      ))}
      <span className="mono" style={{ fontWeight: tone ? 600 : 500, color: t?.ink }}>{title(node)}</span>
      <span className={t?.ink ? undefined : 'mut'} style={{ color: t?.ink, fontSize: 10.5 }}>{sub}</span>
    </button>
  )
}

const nodeTypes = { thread: GraphNode }

export function ThreadGraph({ trace }: { trace: TraceGraph }) {
  const setEvidence = useDemo((s) => s.setEvidence)
  const focusNode = useDemo((s) => s.focusNode)
  const onNodeClick = (_: unknown, n: Node) => {
    focusNode(n.id)
    const ev = NODE_EVIDENCE[n.id]
    if (ev) setEvidence(ev)
  }
  const { nodes, edges } = useMemo(() => {
    const nodes: Node<GraphNodeData>[] = trace.nodes
      .filter((n) => LAYOUT[n.id])
      .map((n) => ({
        id: n.id, type: 'thread', position: { x: LAYOUT[n.id].x, y: LAYOUT[n.id].y },
        width: NODE_W, height: NODE_H, initialWidth: NODE_W, initialHeight: NODE_H,
        data: { node: n, sub: LAYOUT[n.id].sub, tone: LAYOUT[n.id].tone },
      }))
    const edges: RFEdge[] = trace.edges
      .filter((e) => LAYOUT[e.from_id] && LAYOUT[e.to_id] && nodes.some((n) => n.id === e.from_id) && nodes.some((n) => n.id === e.to_id))
      .map((e) => {
        const [a, b] = pickSides(LAYOUT[e.from_id], LAYOUT[e.to_id])
        return {
          id: `${e.from_id}>${e.relation}>${e.to_id}`, source: e.from_id, target: e.to_id,
          sourceHandle: `s-${a}`, targetHandle: `t-${b}`, type: 'smoothstep',
          style: { strokeWidth: 2, ...edgeStyle(e.status) },
        }
      })
    return { nodes, edges }
  }, [trace])

  return (
    <div style={{ position: 'relative', width: 788, height: 260, flex: 'none', background: '#FCFCFD' }}>
      {LANES.map((l, i) => (
        <span key={l.label}>
          <span className="mut" style={{ position: 'absolute', left: l.x, top: 8 }}>{l.label}</span>
          {i > 0 && <span style={{ position: 'absolute', left: l.x - 8, top: 0, height: 260, borderLeft: '1px solid #E3E5E8' }} />}
        </span>
      ))}
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={onNodeClick} width={788} height={260}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }} nodesDraggable={false} nodesConnectable={false}
        panOnDrag={false} zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false} preventScrolling={false}
        elementsSelectable={false} proOptions={{ hideAttribution: true }} style={{ background: 'transparent' }}
      />
      <span className="chip thr mono" style={{ position: 'absolute', left: 146, top: 194 }}>nạp LOT-B 13:52</span>
      <div className="mut" style={{ position: 'absolute', left: 18, top: 232, display: 'flex', gap: 12, fontSize: 11 }}>
        <span><span className="ln" style={{ borderTop: '2px solid #0E7C86' }} />confirmed</span>
        <span><span className="ln" style={{ borderTop: '2px dashed #0E7C86' }} />inferred</span>
        <span><span className="ln" style={{ borderTop: '2px dotted #0E7C86' }} />chờ duyệt</span>
        <span><span className="ln" style={{ borderTop: '2px dotted #8E959F' }} />gợi ý</span>
      </div>
    </div>
  )
}
