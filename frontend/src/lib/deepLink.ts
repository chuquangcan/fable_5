import type { Mode, Step } from '../store/demo'

/** `?step=1..4[&mode=normal|fault]` → the matching state of the demo script (DEMO-14). */
export function parseDeepLink(search: string): { step: Step; mode?: Mode } | null {
  const q = new URLSearchParams(search)
  const step = Number(q.get('step'))
  if (![1, 2, 3, 4].includes(step)) return null
  const mode = q.get('mode')
  return { step: step as Step, mode: mode === 'normal' || mode === 'fault' ? mode : undefined }
}
