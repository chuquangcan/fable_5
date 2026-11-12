import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AgentPanel } from './AgentPanel'
import { useAgentMode } from './mode'
import type { AgentEvent } from './reducer'
import { makeServerSource } from './sources'
import { useDemo } from '../store/demo'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  url: string
  constructor(url: string) { this.url = url; FakeEventSource.instances.push(this) }
  close() { this.closed = true }
  emit(ev: AgentEvent) { this.onmessage?.({ data: JSON.stringify(ev) }) }
}
const last = () => FakeEventSource.instances[FakeEventSource.instances.length - 1]
const tick = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  FakeEventSource.instances = []
  vi.stubGlobal('EventSource', FakeEventSource)
  useAgentMode.setState({ replay: false })
  useDemo.getState().reset()
})
afterEach(() => vi.unstubAllGlobals())

async function collect(it: AsyncIterable<AgentEvent>) {
  const out: AgentEvent[] = []
  for await (const e of it) out.push(e)
  return out
}

test('streams parsed events and closes after done', async () => {
  const p = collect(makeServerSource()('Why?', new AbortController().signal))
  await tick()
  const es = last()
  expect(es.url).toBe('/api/agent/ask?q=Why%3F&claim=CLM-0012')
  es.emit({ type: 'text', text: 'a' })
  es.emit({ type: 'cite', label: 'LOT-B', target_id: 'LOT-B' })
  es.emit({ type: 'done', elapsed_s: 3 })
  expect((await p).map((e) => e.type)).toEqual(['text', 'cite', 'done'])
  expect(es.closed).toBe(true)
})

test('passes reset through so a partial answer can be discarded', async () => {
  const p = collect(makeServerSource()('q', new AbortController().signal))
  await tick()
  last().emit({ type: 'text', text: 'partial' })
  last().emit({ type: 'reset' })
  last().emit({ type: 'done', elapsed_s: 1 })
  expect((await p).map((e) => e.type)).toEqual(['text', 'reset', 'done'])
})

test('asks about the claim of the active product tab; the story claim on the twin', async () => {
  const ask = async () => {
    const p = collect(makeServerSource()('q', new AbortController().signal))
    await tick()
    const claim = new URL(last().url, 'http://x').searchParams.get('claim')
    last().emit({ type: 'done', elapsed_s: 1 })
    await p
    return claim
  }
  useDemo.getState().openClaim('CLM-0009', 'MH20-0457')
  expect(await ask()).toBe('CLM-0009')
  useDemo.getState().openClaim('CLM-0012', 'MH20-0001')
  expect(await ask()).toBe('CLM-0012')
  useDemo.getState().activate('main', 'twin')
  expect(await ask()).toBe('CLM-0012')
})

test('forces mode=replay when toggled', async () => {
  useAgentMode.setState({ replay: true })
  const p = collect(makeServerSource()('q', new AbortController().signal))
  await tick()
  expect(last().url).toContain('mode=replay')
  last().emit({ type: 'done', elapsed_s: 1 })
  await p
})

test('abort closes the connection and ends the stream quietly', async () => {
  const ctrl = new AbortController()
  const p = collect(makeServerSource()('q', ctrl.signal))
  await tick()
  last().emit({ type: 'text', text: 'a' })
  await tick()
  ctrl.abort()
  expect((await p).map((e) => e.type)).toEqual(['text'])
  expect(last().closed).toBe(true)
})

test('connection error before done becomes an error, and EventSource does not auto-retry', async () => {
  const p = collect(makeServerSource()('q', new AbortController().signal))
  await tick()
  last().onerror?.()
  await expect(p).rejects.toThrow(/connection/i)
  expect(last().closed).toBe(true)
})

test('Alt+Shift+D toggles forced replay and shows an amber dot next to "Agent"', async () => {
  render(<AgentPanel />)
  expect(screen.queryByTitle('Replay (Alt+Shift+D)')).toBeNull()
  await act(async () => { await userEvent.keyboard('{Alt>}{Shift>}d{/Shift}{/Alt}') })
  expect(useAgentMode.getState().replay).toBe(true)
  expect(screen.getByTitle('Replay (Alt+Shift+D)')).toBeInTheDocument()
  await act(async () => { await userEvent.keyboard('{Alt>}{Shift>}d{/Shift}{/Alt}') })
  expect(useAgentMode.getState().replay).toBe(false)
})
