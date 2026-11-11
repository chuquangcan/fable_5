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

// VITE_AGENT_SOURCE=server is wired up in Task 13 (SSE client); until then every value resolves to the script.
export const defaultSource: AgentSource = scriptedSource
