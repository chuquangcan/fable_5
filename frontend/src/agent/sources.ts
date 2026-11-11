import { useDemo } from '../store/demo'
import { useAgentMode } from './mode'
import type { AgentEvent } from './reducer'

export const DEMO_QUESTION = 'Vì sao MH20-0001 của CLM-0012 kêu to? Tìm nguyên nhân gốc và phạm vi ảnh hưởng.'
export const FIXTURE_URL = '/fixtures/agent_clm0012.json'

export type AgentSource = (question: string, signal: AbortSignal) => AsyncIterable<AgentEvent>

interface Fixture { question: string; events: { delay_ms: number; event: AgentEvent }[] }

/** Resolves false if the signal aborts before the delay elapses. */
function wait(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false)
  if (ms <= 0) return Promise.resolve(true)
  return new Promise((resolve) => {
    const onAbort = () => { clearTimeout(t); resolve(false) }
    const t = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(true) }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** Replays the recorded fixture with its original timing (scaled by `speed`, 0 = no waiting). */
export const makeScriptedSource =
  (speed = 1): AgentSource =>
  async function* (_question, signal) {
    const res = await fetch(FIXTURE_URL, { signal })
    if (!res.ok) throw new Error(`fixture ${res.status}`)
    const fixture = (await res.json()) as Fixture
    for (const { delay_ms, event } of fixture.events) {
      if (!(await wait(delay_ms * speed, signal))) return
      yield event
    }
  }

export const scriptedSource = makeScriptedSource(1)

/** Streams the backend's SSE endpoint (`/api/agent/ask`); the server decides live vs replay (DEMO_MODE). */
export const makeServerSource =
  (): AgentSource =>
  async function* (question, signal) {
    const params = new URLSearchParams({ q: question, claim: useDemo.getState().claimId ?? 'CLM-0012' })
    if (useAgentMode.getState().replay) params.set('mode', 'replay')
    const es = new EventSource(`/api/agent/ask?${params}`)

    const queue: AgentEvent[] = []
    let failure: Error | null = null
    let finished = false
    let wake: (() => void) | null = null
    const poke = () => { wake?.(); wake = null }

    es.onmessage = (m) => {
      const ev = JSON.parse(m.data as string) as AgentEvent
      if (ev.type === 'done' || ev.type === 'error') finished = true
      queue.push(ev)
      poke()
    }
    es.onerror = () => {
      // EventSource would silently reconnect and re-ask the question; close and surface the failure instead.
      if (!finished) failure = new Error('Mất kết nối tới server agent')
      es.close()
      poke()
    }
    signal.addEventListener('abort', poke, { once: true })

    try {
      for (;;) {
        if (signal.aborted) return
        const ev = queue.shift()
        if (ev) {
          yield ev
          if (ev.type === 'done' || ev.type === 'error') return
          continue
        }
        if (failure) throw failure
        await new Promise<void>((resolve) => { wake = resolve })
      }
    } finally {
      es.close()
    }
  }

// VITE_AGENT_SOURCE=server (frontend/.env.development) streams from the backend; anything else plays the bundled script.
export const defaultSource: AgentSource =
  import.meta.env.VITE_AGENT_SOURCE === 'server' ? makeServerSource() : scriptedSource
