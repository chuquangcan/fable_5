import { useDemo } from './demo'

beforeEach(() => useDemo.getState().reset())

test('initial state', () => {
  const s = useDemo.getState()
  expect([s.claimId, s.activeTab, s.openTabs, s.evidenceTab, s.focusNodeId, s.mode]).toEqual([null, 'claim', [], 'overview', null, 'normal'])
})

test('openClaim switches to fault mode, reset back to normal', () => {
  useDemo.getState().openClaim('CLM-0012'); expect(useDemo.getState().mode).toBe('fault')
  useDemo.getState().reset(); expect(useDemo.getState().mode).toBe('normal')
})

test('setMode toggles the mode', () => {
  useDemo.getState().setMode('fault'); expect(useDemo.getState().mode).toBe('fault')
  useDemo.getState().setMode('normal'); expect(useDemo.getState().mode).toBe('normal')
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
  expect(useDemo.getState().evidenceTab).toBe('overview')
})

test('setFaultOrigin sets fault mode; null only clears; reset clears', () => {
  expect(useDemo.getState().faultOrigin).toBeNull()
  useDemo.getState().setFaultOrigin('M02')
  expect([useDemo.getState().faultOrigin, useDemo.getState().mode]).toEqual(['M02', 'fault'])
  useDemo.getState().setMode('normal')
  useDemo.getState().setFaultOrigin(null)
  expect([useDemo.getState().faultOrigin, useDemo.getState().mode]).toEqual([null, 'normal'])
  useDemo.getState().setFaultOrigin('M02')
  useDemo.getState().reset()
  expect(useDemo.getState().faultOrigin).toBeNull()
})

test('openClaim clears a previously picked fault origin and stays in fault mode', () => {
  useDemo.getState().setFaultOrigin('LOT-B')
  useDemo.getState().openClaim('CLM-0012')
  expect([useDemo.getState().faultOrigin, useDemo.getState().mode]).toEqual([null, 'fault'])
})
