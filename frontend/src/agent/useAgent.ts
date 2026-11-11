import { useCallback, useEffect, useReducer, useRef } from 'react'
import { type AgentEvent, type AgentState, agentReducer, idleAgentState, initialAgentState } from './reducer'
import { type AgentSource, defaultSource } from './sources'

type Action = AgentEvent | { type: 'start'; question: string } | { type: 'stop' }

function reducer(state: AgentState, a: Action): AgentState {
  if (a.type === 'start') return initialAgentState(a.question)
  if (a.type === 'stop') return state.status === 'running' ? { ...state, status: 'idle' } : state
  return agentReducer(state, a)
}

export function useAgent(source: AgentSource = defaultSource) {
  const [state, dispatch] = useReducer(reducer, idleAgentState)
  const ctrl = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    ctrl.current?.abort()
    ctrl.current = null
    dispatch({ type: 'stop' })
  }, [])

  const ask = useCallback(
    (question: string) => {
      ctrl.current?.abort() // a new question cancels the stream still in flight
      const mine = new AbortController()
      ctrl.current = mine
      dispatch({ type: 'start', question })
      void (async () => {
        try {
          for await (const ev of source(question, mine.signal)) {
            if (mine.signal.aborted) return
            dispatch(ev)
          }
        } catch (e) {
          if (!mine.signal.aborted) dispatch({ type: 'error', message: (e as Error).message })
        }
      })()
    },
    [source],
  )

  useEffect(() => () => ctrl.current?.abort(), [])
  return { state, ask, cancel }
}
