import { expect, test } from 'vitest'
import { type AgentEvent, agentReducer, initialAgentState } from './reducer'

test('text accumulates and cites interleave', () => {
  let s = initialAgentState('q')
  for (const e of [
    { type: 'text', text: 'Probable ' }, { type: 'text', text: 'cause' },
    { type: 'cite', label: 'IQC-5531', target_id: 'IQC-5531' },
  ] as AgentEvent[]) s = agentReducer(s, e)
  expect(s.segments).toEqual([
    { kind: 'text', text: 'Probable cause' },
    { kind: 'cite', label: 'IQC-5531', target_id: 'IQC-5531' },
  ])
})

test('text after a cite starts a new segment', () => {
  let s = initialAgentState('q')
  for (const e of [
    { type: 'text', text: 'a ' }, { type: 'cite', label: 'X', target_id: null }, { type: 'text', text: ' b' },
  ] as AgentEvent[]) s = agentReducer(s, e)
  expect(s.segments.map((x) => x.kind)).toEqual(['text', 'cite', 'text'])
})

test('reset clears partial answer', () => { // Review Focus #4
  let s = agentReducer(initialAgentState('q'), { type: 'text', text: 'partial' })
  s = agentReducer(s, { type: 'tool_call', name: 'trace_serial', args: {} })
  s = agentReducer(s, { type: 'reset' })
  expect(s.segments).toEqual([])
  expect(s.toolCalls).toEqual([])
  expect(s.actions).toEqual([])
  expect(s.question).toBe('q')
  expect(s.status).toBe('running')
})

test('tool calls, actions, done and error', () => {
  let s = initialAgentState('q')
  s = agentReducer(s, { type: 'tool_call', name: 'trace_serial', args: { serial: 'MH20-0001' } })
  s = agentReducer(s, { type: 'action', action: 'open_impact' })
  expect(s.toolCalls).toEqual([{ name: 'trace_serial', args: { serial: 'MH20-0001' } }])
  expect(s.actions).toEqual(['open_impact'])
  const done = agentReducer(s, { type: 'done', elapsed_s: 21 })
  expect(done.status).toBe('done')
  expect(done.elapsed_s).toBe(21)
  expect(agentReducer(s, { type: 'error', message: 'boom' }).status).toBe('error')
})
