import { Handle, type Node, type NodeProps, Position } from '@xyflow/react'
import type { NodeState } from '../api/types'
import { useDemo } from '../store/demo'
import type { TwinNodeData } from './twinLayout'

const STATE_TEXT: Record<string, string> = { running: 'running', stopped: 'stopped', warning: 'warning', watch4m: '4M watch' }
const SIDES = [['l', Position.Left], ['r', Position.Right], ['t', Position.Top], ['b', Position.Bottom]] as const

export interface TwinNodeProps extends Record<string, unknown> { n: TwinNodeData; st?: NodeState; alerts: boolean; deptHl: boolean }

/** A plant asset on the twin: name, live state (with the Alerts layer) and value. */
export function TwinNode({ data }: NodeProps<Node<TwinNodeProps>>) {
  const { n, st, alerts, deptHl } = data
  const sel = useDemo((s) => s.twin.selected === n.id)
  const tone = useDemo((s) => (!alerts ? null : s.reach.red.includes(n.id) ? 'red' : s.reach.orange.includes(n.id) ? 'orange' : null))
  const hover = useDemo((s) => s.hoverIds.includes(n.id))
  const state = alerts && st && STATE_TEXT[st.state] ? st.state : null
  const cls = ['gn', 'twin-node', `tn-${n.type}`, sel && 'sel', tone, hover && 'hover', deptHl && 'dept-hl'].filter(Boolean).join(' ')
  return (
    <div data-testid={`twin-${n.id}`} className={cls} title={n.line ? `${n.line} › ${n.name}` : n.name}>
      {SIDES.map(([s, p]) => (
        <span key={s}>
          <Handle id={`s-${s}`} type="source" position={p} style={{ opacity: 0, pointerEvents: 'none' }} isConnectable={false} />
          <Handle id={`t-${s}`} type="target" position={p} style={{ opacity: 0, pointerEvents: 'none' }} isConnectable={false} />
        </span>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span className="mono ellipsis" style={{ fontWeight: 600 }}>{n.name}</span>
        {st?.sub && <span className="mut" style={{ fontSize: 10.5 }}>{st.sub}</span>}
        <span style={{ flex: 1 }} />
        {state && <span className={`st st-${state}`}>{STATE_TEXT[state]}</span>}
      </div>
      {st?.value ? <span className="mono ellipsis twin-value">{st.value}</span> : n.type === 'volume' ? <span className="mut" style={{ fontSize: 10.5 }}>double-click for serials</span> : null}
    </div>
  )
}
