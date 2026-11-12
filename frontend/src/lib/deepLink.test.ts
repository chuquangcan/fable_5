import { beforeEach, expect, test } from 'vitest'
import { useDemo } from '../store/demo'
import { parseDeepLink } from './deepLink'
import { DEMO_QUESTION } from './story'

beforeEach(() => useDemo.getState().reset())

test('parses ?step and ?mode; ignores anything else', () => {
  expect(parseDeepLink('?step=3&mode=normal')).toEqual({ step: 3, mode: 'normal' })
  expect(parseDeepLink('?step=2&mode=weird')).toEqual({ step: 2, mode: undefined })
  expect(parseDeepLink('?step=7')).toBeNull()
  expect(parseDeepLink('')).toBeNull()
})

test('applyStep builds each step of the demo script', () => {
  const s = () => useDemo.getState()
  s().applyStep(1)
  expect([s().claimId, s().view, s().mode]).toEqual([null, 'product', 'normal'])
  s().applyStep(2)
  expect([s().claimId, s().activeTab, s().mode]).toEqual(['CLM-0012', 'thread', 'fault'])
  s().applyStep(3, 'normal')
  expect([s().focusNodeId, s().evidenceTab, s().mode]).toEqual(['LOT-B', 'lot', 'normal'])
  s().applyStep(4)
  expect(s().agentCmd).toMatchObject({ kind: 'ask', question: DEMO_QUESTION })
})

test('reset tells the agent panel to clear', () => {
  const n = useDemo.getState().agentCmd.n
  useDemo.getState().reset()
  expect(useDemo.getState().agentCmd).toEqual({ kind: 'clear', n: n + 1 })
})
