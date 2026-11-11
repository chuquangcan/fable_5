import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import type { AgentEvent } from './reducer'
import { makeScriptedSource } from './sources'
import { useAgent } from './useAgent'
import type { AgentState } from './reducer'

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((res) => {
    const t = setTimeout(res, ms)
    signal.addEventListener('abort', () => { clearTimeout(t); res() })
  })

// Streams "A…" for the first question and "B…" for the second, slowly.
async function* fakeSource(q: string, signal: AbortSignal): AsyncGenerator<AgentEvent> {
  const tag = q === 'first' ? 'A' : 'B'
  for (let i = 0; i < 3; i++) {
    await sleep(15, signal)
    if (signal.aborted) return
    yield { type: 'text', text: `${tag}${i} ` }
  }
  yield { type: 'done', elapsed_s: 1 }
}
const textOf = (s: AgentState) => s.segments.map((x) => (x.kind === 'text' ? x.text : x.label)).join('')

test('asking again aborts the previous stream', async () => { // Review Focus #5
  const { result } = renderHook(() => useAgent(fakeSource))
  act(() => { result.current.ask('first'); result.current.ask('second') })
  await waitFor(() => expect(result.current.state.status).toBe('done'))
  expect(textOf(result.current.state)).not.toContain('A')
  expect(textOf(result.current.state)).toContain('B2')
  expect(result.current.state.question).toBe('second')
})

test('cancel stops the stream', async () => {
  const { result } = renderHook(() => useAgent(fakeSource))
  act(() => { result.current.ask('first') })
  act(() => { result.current.cancel() })
  await new Promise((r) => setTimeout(r, 80))
  expect(result.current.state.status).not.toBe('done')
})

test('scripted source replays the fixture and stops on abort', async () => {
  const fixture = {
    question: 'q',
    events: [
      { delay_ms: 500, event: { type: 'tool_call', name: 'trace_serial', args: {} } },
      { delay_ms: 500, event: { type: 'text', text: 'x' } },
      { delay_ms: 500, event: { type: 'done', elapsed_s: 1 } },
    ],
  }
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => fixture })))
  const all: string[] = []
  for await (const e of makeScriptedSource(0)('q', new AbortController().signal)) all.push(e.type)
  expect(all).toEqual(['tool_call', 'text', 'done'])

  const ctrl = new AbortController()
  const seen: string[] = []
  for await (const e of makeScriptedSource(0)('q', ctrl.signal)) { seen.push(e.type); ctrl.abort() }
  expect(seen).toEqual(['tool_call'])
  vi.unstubAllGlobals()
})
