import { useDemo } from './demo'

beforeEach(() => useDemo.getState().reset())

test('initial state', () => {
  const s = useDemo.getState()
  expect([s.claimId, s.activeTab, s.openTabs, s.evidenceTab, s.focusNodeId]).toEqual([null, 'claim', [], 'm02', null])
})

test('openClaim opens claim+thread tabs and activates thread', () => {
  useDemo.getState().openClaim('CLM-0012')
  const s = useDemo.getState()
  expect([s.claimId, s.openTabs, s.activeTab]).toEqual(['CLM-0012', ['claim', 'thread'], 'thread'])
})

test('setTab opens the report tab on demand and reset restores the initial state', () => {
  useDemo.getState().openClaim('CLM-0012')
  useDemo.getState().setTab('report')
  expect(useDemo.getState().openTabs).toEqual(['claim', 'thread', 'report'])
  useDemo.getState().setEvidence('impact')
  useDemo.getState().focusNode('LOT-B')
  useDemo.getState().reset()
  expect(useDemo.getState().claimId).toBeNull()
  expect(useDemo.getState().evidenceTab).toBe('m02')
})
