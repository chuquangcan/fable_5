import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import type { Claim, LinkView } from '../api/types'
import { activeMain, activeProduct, agentContext, DEFAULT_AS_OF, detailTabId, threadTabId, useDemo } from './demo'

vi.mock('../api/client')

const s = () => useDemo.getState()
const ids = (g: 'main' | 'bottom' | 'bottom2') => s().groups[g].tabs.map((t) => t.id)
const T1 = threadTabId('MH20-0001')
const T2 = threadTabId('MH20-0457')

beforeEach(() => {
  try { localStorage.clear() } catch { /* no storage */ }
  s().reset()
})

test('initial workspace: pinned twin, pinned plant overview, feed rail, demo clock', () => {
  expect(ids('main')).toEqual(['twin'])
  expect(s().groups.main.active).toBe('twin')
  expect(s().groups.main.tabs[0]).toMatchObject({ kind: 'twin', title: 'Plant', pinned: true })
  expect(ids('bottom')).toEqual(['overview', 'table:sources', 'review'])
  expect(s().groups.bottom.tabs[0]).toMatchObject({ title: 'Plant overview', pinned: true })
  expect(s().groups.bottom.active).toBe('overview')
  expect(ids('bottom2')).toEqual([])
  expect(s().layout).toEqual({ rail: 'feed', leftW: 280, agentW: 340, dockH: 300, dockCollapsed: false, split: false })
  expect(s().asOf).toBe(DEFAULT_AS_OF)
  expect(activeMain(s())?.id).toBe('twin')
  expect(activeProduct(s())).toBeNull()
})

test('openProduct opens a thread tab without a claim and its details tab in the dock', () => {
  const id = s().openProduct('MH20-0457')
  expect(id).toBe(T2)
  expect(s().groups.main.active).toBe(T2)
  expect(s().groups.main.tabs[1]).toMatchObject({ kind: 'thread', title: 'Thread · MH20-0457', preview: false })
  expect(s().product[T2]).toMatchObject({ root: 'MH20-0457', claimId: null, mode: 'normal', focusNodeId: null })
  expect(s().groups.bottom.active).toBe(detailTabId(T2))
  expect(s().groups.bottom.tabs.find((t) => t.id === detailTabId(T2))).toMatchObject({ kind: 'thread', target: T2, title: 'Details · MH20-0457' })
})

test('two product tabs keep their own focused node and fault mode', () => {
  s().openClaim('CLM-0012', 'MH20-0001')
  s().focusNode(T1, 'LOT-B')
  s().openProduct('MH20-0457')
  s().focusNode(T2, 'M02')
  expect(s().product[T1]).toMatchObject({ focusNodeId: 'LOT-B', mode: 'fault', claimId: 'CLM-0012' })
  expect(s().product[T2]).toMatchObject({ focusNodeId: 'M02', mode: 'normal', claimId: null })
  s().activate('main', T1)
  expect(activeProduct(s())?.tabId).toBe(T1)
  expect(s().groups.bottom.active).toBe(detailTabId(T1))
})

test('fault mode and fault origin need a claim on the tab', () => {
  s().openProduct('MH20-0457')
  s().setMode(T2, 'fault')
  s().setFaultOrigin(T2, 'M02')
  expect(s().product[T2]).toMatchObject({ mode: 'normal', faultOrigin: null })
  s().openClaim('CLM-0012', 'MH20-0001')
  s().setMode(T1, 'normal')
  s().setFaultOrigin(T1, 'M02')
  expect(s().product[T1]).toMatchObject({ mode: 'fault', faultOrigin: 'M02' })
})

test('the dock follows the active main tab and restores what it showed', () => {
  void s().goTo('M02')
  expect(s().groups.bottom.active).toBe('object:M02')
  expect(s().groups.bottom.tabs.find((t) => t.id === 'object:M02')?.preview).toBe(true)
  expect(s().twin.selected).toBe('M02')
  s().openProduct('MH20-0457')
  expect(s().groups.bottom.active).toBe(detailTabId(T2))
  s().activate('main', 'twin')
  expect(s().groups.bottom.active).toBe('object:M02')
  s().activate('main', T2)
  expect(s().groups.bottom.active).toBe(detailTabId(T2))
})

test('selecting nothing on the twin brings the dock back to the plant overview', () => {
  s().selectTwin('M02', 'Line 1 › M02')
  expect(s().groups.bottom.tabs.find((t) => t.id === 'object:M02')?.title).toBe('Line 1 › M02')
  s().selectTwin(null)
  expect([s().twin.selected, s().groups.bottom.active]).toEqual([null, 'overview'])
})

test('goTo: documents, serials, boxes and claims open main tabs', async () => {
  vi.mocked(api.getLinks).mockResolvedValue([
    { link_id: 1, from_id: 'MH20-0003', to_id: 'BOX-001', relation: 'packed_in' } as unknown as LinkView,
  ])
  vi.mocked(api.getClaim).mockResolvedValue({ id: 'CLM-0012', serial: 'MH20-0001', traceable: true } as Claim)
  await s().goTo('D-07')
  expect(s().groups.main.tabs.find((t) => t.id === 'doc:D-07')).toMatchObject({ kind: 'doc', target: 'D-07' })
  await s().goTo('MH20-0002')
  expect(s().groups.main.active).toBe(threadTabId('MH20-0002'))
  await s().goTo('BOX-001')
  expect(s().groups.main.active).toBe(threadTabId('MH20-0003'))
  await s().goTo('CLM-0012')
  expect(s().groups.main.active).toBe(T1)
  expect(s().product[T1]).toMatchObject({ claimId: 'CLM-0012', mode: 'fault' })
})

test('goTo: a claim whose serial is not in the data opens nothing', async () => {
  vi.mocked(api.getClaim).mockResolvedValue({ id: 'CLM-0011', serial: 'MH20-2457', traceable: false } as Claim)
  await s().goTo('CLM-0011')
  expect(ids('main')).toEqual(['twin'])
})

test('goTo: an object on the active thread is focused there as well', async () => {
  s().openClaim('CLM-0012', 'MH20-0001')
  s().setThreadIds(T1, ['MH20-0001', 'LOT-B', 'M02'])
  await s().goTo('LOT-B')
  expect(s().product[T1].focusNodeId).toBe('LOT-B')
  expect(s().groups.main.active).toBe(T1)
})

test('pinned tabs cannot be closed', () => {
  const before = s().groups
  s().closeTab('main', 'twin')
  s().closeTab('bottom', 'overview')
  expect(s().groups).toBe(before)
})

test('closing a product tab while its details are in the dock leaves nothing behind', () => {  // Review Focus #3
  s().openProduct('MH20-0457')
  s().selectNode(T2, 'M02')
  s().setEvidence(T2, 'events')
  expect(s().groups.bottom.active).toBe(detailTabId(T2))
  s().closeTab('main', T2)
  expect(s().product[T2]).toBeUndefined()
  expect(s().evidence[T2]).toBeUndefined()
  expect(ids('bottom').some((id) => id.startsWith(detailTabId(T2)))).toBe(false)
  expect([s().groups.main.active, s().groups.bottom.active]).toEqual(['twin', 'overview'])
})

test('closing a details tab is allowed and selecting a node reopens it', () => {
  s().openProduct('MH20-0457')
  s().closeTab('bottom', detailTabId(T2))
  expect(ids('bottom')).not.toContain(detailTabId(T2))
  s().selectNode(T2, 'M02')
  expect(s().groups.bottom.active).toBe(detailTabId(T2))
})

test('selectNode picks the evidence sub-tab the fault story needs', () => {
  s().openClaim('CLM-0012', 'MH20-0001')
  s().selectNode(T1, 'LOT-B')
  expect(s().evidence[T1]).toBe('lot')
  s().openProduct('MH20-0457')
  s().selectNode(T2, 'LOT-B')
  expect(s().evidence[T2]).toBe('overview')
})

test('viewOnThread: one tab is focused, several ask which', () => {
  s().openClaim('CLM-0012', 'MH20-0001')
  s().setThreadIds(T1, ['LOT-B'])
  s().activate('main', 'twin')
  s().viewOnThread('LOT-B')
  expect([s().groups.main.active, s().product[T1].focusNodeId]).toEqual([T1, 'LOT-B'])
  s().openProduct('MH20-0457')
  s().setThreadIds(T2, ['LOT-B'])
  s().activate('main', 'twin')
  s().viewOnThread('LOT-B')
  expect(s().picker).toEqual({ id: 'LOT-B', tabIds: [T1, T2] })
  s().closePicker()
  expect(s().picker).toBeNull()
})

test('viewOnPlant brings the twin forward with the object selected', () => {
  s().openProduct('MH20-0457')
  s().viewOnPlant('M02')
  expect([s().groups.main.active, s().twin.selected, s().groups.bottom.active]).toEqual(['twin', 'M02', 'object:M02'])
})

test('openReport opens a report tab for the claim', () => {
  s().openReport('CLM-0012')
  expect(s().groups.main.tabs.find((t) => t.id === 'report:CLM-0012')).toMatchObject({ kind: 'report', title: 'RCA report · CLM-0012' })
})

test('split moves the active dock tab into a second group; emptying it unsplits', () => {
  s().activate('bottom', 'review')
  s().splitDock(true)
  expect([ids('bottom2'), s().layout.split]).toEqual([['review'], true])
  expect(ids('bottom')).not.toContain('review')
  s().closeTab('bottom2', 'review')
  expect([ids('bottom2'), s().layout.split]).toEqual([[], false])
})

test('moveTab and keepTab work on any group', () => {
  s().moveTab('bottom', 'review', 'table:sources')
  expect(ids('bottom')).toEqual(['overview', 'review', 'table:sources'])
  void s().goTo('M02')
  s().keepTab('bottom', 'object:M02')
  expect(s().groups.bottom.tabs.find((t) => t.id === 'object:M02')?.preview).toBe(false)
})

test('a broken or outdated saved workspace falls back to the default one', async () => {  // Review Focus #1
  localStorage.setItem('onethread.workspace', '{garbage')
  await useDemo.persist.rehydrate()
  expect(s().groups.main.tabs[0].id).toBe('twin')
  localStorage.setItem('onethread.workspace', JSON.stringify({ state: { groups: { main: { tabs: [], active: null } } }, version: 0 }))
  await useDemo.persist.rehydrate()
  expect(ids('main')).toEqual(['twin'])
  localStorage.setItem('onethread.workspace', JSON.stringify({ state: { groups: { main: { tabs: [], active: null } } }, version: 1 }))
  await useDemo.persist.rehydrate()
  expect(ids('main')).toEqual(['twin'])
})

test('the workspace is saved, so the app reopens on the last active tab', async () => {
  s().openProduct('MH20-0457')
  const saved = JSON.parse(localStorage.getItem('onethread.workspace') ?? '{}')
  expect(saved.state.groups.main.active).toBe(T2)
  s().activate('main', 'twin')
  localStorage.setItem('onethread.workspace', JSON.stringify(saved))
  await useDemo.persist.rehydrate()
  expect(s().groups.main.active).toBe(T2)
})

test('reset tells the agent panel to clear and goes back to the first screen', () => {
  s().openProduct('MH20-0457')
  const n = s().agentCmd.n
  s().reset()
  expect(s().agentCmd).toEqual({ kind: 'clear', n: n + 1 })
  expect(ids('main')).toEqual(['twin'])
})

test('flash marks a node briefly', () => {
  vi.useFakeTimers()
  s().flash('LOT-B')
  expect(s().flashNodeId).toBe('LOT-B')
  vi.advanceTimersByTime(1300)
  expect(s().flashNodeId).toBeNull()
  vi.useRealTimers()
})

test('twin layers toggle and survive selecting an object; an old save without layers gets the defaults', async () => {
  expect(s().twin.layers).toEqual({ machines: true, lots: false, alerts: true, flow: true })
  s().toggleLayer('machines')
  s().selectTwin('M02')
  expect(s().twin).toMatchObject({ selected: 'M02', layers: { machines: false } })
  const saved = JSON.parse(localStorage.getItem('onethread.workspace') ?? '{}')
  saved.state.twin = { selected: 'M01' }
  localStorage.setItem('onethread.workspace', JSON.stringify(saved))
  await useDemo.persist.rehydrate()
  expect(s().twin).toEqual({ selected: 'M01', layers: { machines: true, lots: false, alerts: true, flow: true } })
})

test('agent context: the plant, a selected object, a feed card, a product tab with its claim and focus', async () => {
  vi.mocked(api.getFault).mockResolvedValue({ origin: 'M02', at: '', red: [], orange: [] })
  vi.mocked(api.getImpact).mockResolvedValue({ lot: 'LOT-B', shipments: [] } as never)
  expect(agentContext(s())).toBe('Plant')
  s().selectTwin('M02', 'Line 1 › M02')
  expect(agentContext(s())).toBe('Plant › M02')
  await s().selectCard({ id: 'AL-0001', kind: 'alert', badge: 'P1', at: '2026-11-03T14:00:00+07:00', objects: ['M02'], ref: {} } as never)
  expect(agentContext(s())).toBe('Feed · AL-0001')
  s().openClaim('CLM-0012', 'MH20-0001')
  expect(agentContext(s())).toBe('Thread · MH20-0001 (CLM-0012)')
  s().selectNode(T1, 'LOT-B')
  expect(agentContext(s())).toBe('Thread · MH20-0001 (CLM-0012) › LOT-B')
  s().openProduct('MH20-0457')
  expect(agentContext(s())).toBe('Thread · MH20-0457')
  s().openDoc('D-07')
  expect(agentContext(s())).toBe('D-07')
  s().activate('main', 'twin')
  expect(agentContext(s())).toBe('Feed · AL-0001')
})
