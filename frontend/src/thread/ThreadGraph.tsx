import '@xyflow/react/dist/style.css'
import { Handle, type Node, type NodeProps, Position, ReactFlow, type Edge as RFEdge } from '@xyflow/react'
import { useMemo } from 'react'
import type { FlowGraph, FlowNode } from '../api/types'
import { useDemo } from '../store/demo'
import { flowLayout } from './flowLayout'
import { edgeStyle, faultEdgeStyle, NODE_H, NODE_W, neutralEdgeStyle, pickSides, type Side } from './layout'

const POS: Record<Side, Position> = { l: Position.Left, r: Position.Right, t: Position.Top, b: Position.Bottom }
const NAMED_TYPES = new Set(['machine', 'hopper', 'supplier', 'customer', 'aggregate'])

const title = (n: FlowNode) => (NAMED_TYPES.has(n.type) ? n.name : n.id)

type Tone = 'red' | 'orange'
interface GraphNodeData extends Record<string, unknown> { node: FlowNode; attachments: number; tone?: Tone; reason?: string; claimMark: boolean }

function GraphNode({ data }: NodeProps<Node<GraphNodeData>>) {
  const { node, attachments, tone, reason, claimMark } = data
  const focused = useDemo((s) => s.focusNodeId === node.id)
  const flashing = useDemo((s) => s.flashNodeId === node.id)
  const head = title(node)
  return (
    <>
      <button
        className={`${tone ? `gn gn-${tone}` : 'gn'}${flashing ? ' gn-flash' : ''}`}
        title={reason ?? (claimMark ? 'điểm báo lỗi' : undefined)}
        style={{
          position: 'relative', padding: '2px 4px', whiteSpace: 'nowrap', overflow: 'hidden',
          ...(claimMark ? { border: '2px solid #000', ...(tone ? {} : { background: '#FFFFFF' }) } : {}),
          ...(focused ? { outline: '2px solid #0E7C86', outlineOffset: 1 } : {}),
        }}
      >
        {(['l', 'r', 't', 'b'] as Side[]).map((s) => (
          <span key={s}>
            <Handle id={`s-${s}`} type="source" position={POS[s]} style={{ opacity: 0, pointerEvents: 'none' }} isConnectable={false} />
            <Handle id={`t-${s}`} type="target" position={POS[s]} style={{ opacity: 0, pointerEvents: 'none' }} isConnectable={false} />
          </span>
        ))}
        <span className="mono" style={{ fontWeight: 500, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{head}</span>
        {node.sub && node.sub !== head && (
          <span className="mut" style={{ fontSize: 10.5, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.sub}</span>
        )}
      </button>
      {attachments > 0 && (
        <span data-testid={`att-${node.id}`} className="chip mut" style={{ position: 'absolute', left: 0, top: NODE_H + 3, height: 16, fontSize: 10.5 }}>
          {attachments} đính kèm
        </span>
      )}
    </>
  )
}

const nodeTypes = { thread: GraphNode }

export function ThreadGraph({ flow, marks, reasons }: { flow: FlowGraph; marks?: Record<string, Tone>; reasons?: Record<string, string> }) {
  const mode = useDemo((s) => s.mode)
  const selectNode = useDemo((s) => s.selectNode)
  const onNodeClick = (_: unknown, n: Node) => selectNode(n.id)

  const layout = useMemo(() => flowLayout(flow), [flow])
  const { nodes, edges } = useMemo(() => {
    const pos = new Map(layout.nodes.map((p) => [p.id, p]))
    const nodes: Node<GraphNodeData>[] = [...flow.spine, ...flow.branches].map((n) => {
      const p = pos.get(n.id)!
      return {
        id: n.id, type: 'thread', position: { x: p.x, y: p.y },
        width: NODE_W, height: NODE_H, initialWidth: NODE_W, initialHeight: NODE_H,
        data: {
          node: n, attachments: flow.attachments[n.id]?.length ?? 0,
          tone: marks?.[n.id], reason: marks?.[n.id] ? reasons?.[n.id] : undefined,
          claimMark: !!marks && n.type === 'claim',
        },
      }
    })
    const style = mode === 'fault' ? edgeStyle : neutralEdgeStyle
    const edges: RFEdge[] = flow.edges
      .filter((e) => pos.has(e.up) && pos.has(e.down))
      .map((e) => {
        const [a, b] = pickSides(pos.get(e.up)!, pos.get(e.down)!)
        return {
          id: `${e.up}>${e.relation}>${e.down}`, source: e.up, target: e.down,
          sourceHandle: `s-${a}`, targetHandle: `t-${b}`, type: 'smoothstep',
          style: { strokeWidth: 2, ...style(e.status), ...faultEdgeStyle(marks?.[e.up], marks?.[e.down]), ...(e.active ? {} : { opacity: 0.45 }) },
        }
      })
    return { nodes, edges }
  }, [flow, layout, mode, marks, reasons])

  const { width, height, bands } = layout
  const ink = mode === 'fault' ? '#0E7C86' : '#8E959F'
  return (
    <div style={{ position: 'relative', width, height, flex: 'none', background: '#FCFCFD' }}>
      {bands.map((b, i) => (
        <div
          key={`${b.stage}-${b.x}`}
          data-testid={`band-${b.stage}`}
          style={{ position: 'absolute', left: b.x, top: 0, width: b.w, height, background: i % 2 ? '#F5F6F8' : 'transparent', borderLeft: i > 0 ? '1px solid #E3E5E8' : undefined }}
        >
          <span className="mut" style={{ position: 'absolute', left: 10, top: 10, fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>{b.label}</span>
        </div>
      ))}
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={onNodeClick} width={width} height={height}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }} nodesDraggable={false} nodesConnectable={false}
        panOnDrag={false} zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false} preventScrolling={false}
        elementsSelectable={false} proOptions={{ hideAttribution: true }} style={{ background: 'transparent' }}
      />
      <div className="mut" style={{ position: 'absolute', left: 16, top: height - 22, display: 'flex', gap: 12, fontSize: 11 }}>
        <span><span className="ln" style={{ borderTop: `2px solid ${ink}` }} />confirmed</span>
        <span><span className="ln" style={{ borderTop: `2px dashed ${ink}` }} />inferred</span>
        <span><span className="ln" style={{ borderTop: `2px dotted ${ink}` }} />chờ duyệt</span>
        <span><span className="ln" style={{ borderTop: '2px dotted #8E959F' }} />gợi ý</span>
        {marks && <span>Đỏ: điểm lỗi và thượng nguồn · Cam: hạ nguồn có thể bị ảnh hưởng</span>}
      </div>
    </div>
  )
}
