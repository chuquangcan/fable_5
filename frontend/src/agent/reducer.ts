export type AgentEvent =
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'text'; text: string }
  | { type: 'cite'; label: string; target_id: string | null }
  | { type: 'action'; action: 'open_impact' | 'open_report' }
  | { type: 'reset' }
  | { type: 'done'; elapsed_s: number }
  | { type: 'error'; message: string }

export type Segment = { kind: 'text'; text: string } | { kind: 'cite'; label: string; target_id: string | null }
export type AgentAction = 'open_impact' | 'open_report'

export interface AgentState {
  question: string
  toolCalls: { name: string; args: Record<string, unknown> }[]
  segments: Segment[]
  actions: AgentAction[]
  status: 'idle' | 'running' | 'done' | 'error'
  elapsed_s: number
  error?: string
}

export const idleAgentState: AgentState = {
  question: '', toolCalls: [], segments: [], actions: [], status: 'idle', elapsed_s: 0,
}

export const initialAgentState = (question: string): AgentState => ({ ...idleAgentState, question, status: 'running' })

export function agentReducer(state: AgentState, ev: AgentEvent): AgentState {
  switch (ev.type) {
    case 'tool_call':
      return { ...state, toolCalls: [...state.toolCalls, { name: ev.name, args: ev.args }] }
    case 'text': {
      const last = state.segments[state.segments.length - 1]
      const segments: Segment[] =
        last?.kind === 'text'
          ? [...state.segments.slice(0, -1), { kind: 'text', text: last.text + ev.text }]
          : [...state.segments, { kind: 'text', text: ev.text }]
      return { ...state, segments }
    }
    case 'cite':
      return { ...state, segments: [...state.segments, { kind: 'cite', label: ev.label, target_id: ev.target_id }] }
    case 'action':
      return state.actions.includes(ev.action) ? state : { ...state, actions: [...state.actions, ev.action] }
    case 'reset':
      return { ...state, toolCalls: [], segments: [], actions: [], status: 'running', elapsed_s: 0, error: undefined }
    case 'done':
      return { ...state, status: 'done', elapsed_s: ev.elapsed_s }
    case 'error':
      return { ...state, status: 'error', error: ev.message }
  }
}
