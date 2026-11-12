import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import type { Claim, FaultTrace, FeedItem, Impact } from '../api/types'
import { useDemo } from '../store/demo'
import feed from '../test/fixtures/feed.json'
import { FeedSidebar } from './FeedSidebar'
import { feedFilter } from './useFeed'

vi.mock('../api/client')

const items = feed as FeedItem[]
const st = () => useDemo.getState()
const card = (id: string) => screen.getByRole('article', { name: id })
const trace = (red: string[], orange: string[] = []): FaultTrace =>
  ({ origin: red[0], at: '', red: red.map((id) => ({ id, reason: '' })), orange: orange.map((id) => ({ id, reason: '' })) }) as FaultTrace

beforeEach(() => {
  try { localStorage.clear() } catch { /* no storage */ }
  st().reset()
  vi.mocked(api.getFeed).mockResolvedValue(items)
  vi.mocked(api.getFault).mockResolvedValue(trace(['M02', 'LOT-B'], ['HOP-1']))
  vi.mocked(api.getClaimFault).mockResolvedValue(trace(['MH20-0001']))
  vi.mocked(api.getImpact).mockResolvedValue({ lot: 'LOT-B', shipments: [{ id: 'SHP-1120' }] } as Impact)
  vi.mocked(api.getClaim).mockResolvedValue({ id: 'CLM-0009', serial: 'MH20-2457', traceable: false } as Claim)
  vi.mocked(api.reviewLink).mockResolvedValue({} as never)
})

test('filter chips count each kind; Claims leaves only claim cards', async () => {
  render(<FeedSidebar />)
  expect(await screen.findByRole('button', { name: `All ${items.length}` })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Alerts 1' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '4M changes 2' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Claims 3' }))
  expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['CLM-0012', 'CLM-0011', 'CLM-0009'])
})

test('newest card first; a card shows its sender filled and who must act outlined', async () => {
  render(<FeedSidebar />)
  await screen.findByRole('article', { name: 'AL-0001' })
  expect(screen.getAllByRole('article')[0]).toHaveAccessibleName('CLM-0012')
  const al = card('AL-0001')
  expect(within(al).getByRole('button', { name: 'Production' })).toHaveClass('pill', 'filled')
  expect(within(al).getByRole('button', { name: 'Quality' })).toHaveClass('pill', 'outline')
  expect(within(al).getByRole('button', { name: 'Maintenance' })).toHaveClass('pill', 'outline')
  expect(al).toHaveClass('foreign')
  expect(card('4M-0001')).not.toHaveClass('foreign')
})

test('a department pill filters the feed by sender or acting department; ✕ clears it', async () => {
  render(<FeedSidebar />)
  await userEvent.click(within(await screen.findByRole('article', { name: 'AL-0001' })).getByRole('button', { name: 'Maintenance' }))
  expect(st().feed.dept).toBe('maintenance')
  expect(st().feed.selected).toBeNull()
  expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['AL-0001'])
  await userEvent.click(screen.getByRole('button', { name: 'Clear department filter Maintenance' }))
  expect(screen.getAllByRole('article')).toHaveLength(items.length)
})

test('feedFilter matches kind and department', () => {
  expect(feedFilter(items, 'alert', null).map((i) => i.id)).toEqual(['AL-0001'])
  expect(feedFilter(items, 'all', 'warehouse').map((i) => i.id)).toEqual(['4M-0002', 'D-07'])
})

test('an object pill navigates to the object without selecting the card', async () => {
  render(<FeedSidebar />)
  await userEvent.click(within(await screen.findByRole('article', { name: 'AL-0001' })).getByRole('button', { name: 'M02' }))
  expect(st().twin.selected).toBe('M02')
  expect(st().feed.selected).toBeNull()
})

test('hovering a card highlights its objects', async () => {
  render(<FeedSidebar />)
  fireEvent.mouseEnter(await screen.findByRole('article', { name: '4M-0002' }))
  expect(st().hoverIds).toEqual(['HOP-1', 'LOT-B', 'M02'])
  fireEvent.mouseLeave(card('4M-0002'))
  expect(st().hoverIds).toEqual([])
})

test('selecting a card: as-of, read, preview details tab, fault reach and impact', async () => {
  render(<FeedSidebar />)
  const al = await screen.findByRole('article', { name: 'AL-0001' })
  expect(al).toHaveAttribute('data-unread')
  await userEvent.click(al)
  expect(st().asOf).toBe('2026-11-03T14:00:00+07:00')
  expect(st().feed.selected).toBe('AL-0001')
  expect(st().groups.bottom.tabs.find((t) => t.id === 'feed:AL-0001')).toMatchObject({ kind: 'feed', target: 'AL-0001', preview: true, title: 'P1 · AL-0001' })
  expect(card('AL-0001')).not.toHaveAttribute('data-unread')
  expect(api.getFault).toHaveBeenCalledWith('M02', '2026-11-03T14:00:00+07:00')
  expect(api.getImpact).toHaveBeenCalledWith('LOT-B')
  await vi.waitFor(() => expect(st().reach).toEqual({ red: ['M02', 'LOT-B'], orange: ['HOP-1', 'SHP-1120'] }))
})

test('read cards are saved with the workspace', async () => {
  await st().selectCard(items.find((i) => i.id === 'D-07')!)
  const saved = JSON.parse(localStorage.getItem('onethread.workspace') ?? '{}')
  expect(saved.state.feed.read).toEqual(['D-07'])
})

test('a failing fault trace leaves the reach empty', async () => {  // Review Focus #4
  vi.mocked(api.getFault).mockRejectedValue(new Error('404 origin CLM-0009 not found'))
  st().setReach({ red: ['X'], orange: ['Y'] })
  await st().selectCard(items.find((i) => i.id === 'D-03')!)
  expect(st().reach).toEqual({ red: [], orange: [] })
})

test('a claim card uses the claim fault trace and no impact without a lot', async () => {  // Review Focus #4
  await st().selectCard(items.find((i) => i.id === 'CLM-0009')!)
  expect(api.getClaimFault).toHaveBeenCalledWith('CLM-0009')
  expect(api.getImpact).not.toHaveBeenCalled()
  expect(st().reach).toEqual({ red: ['MH20-0001'], orange: [] })
})

test('an older card answering late does not overwrite the newer card', async () => {  // Review Focus #4
  let resolveA: (t: FaultTrace) => void = () => {}
  vi.mocked(api.getFault)
    .mockImplementationOnce(() => new Promise((r) => { resolveA = r }))
    .mockResolvedValueOnce(trace(['HOP-1']))
  vi.mocked(api.getImpact).mockResolvedValue({ lot: 'LOT-B', shipments: [] } as unknown as Impact)
  const a = st().selectCard(items.find((i) => i.id === 'AL-0001')!)
  await st().selectCard(items.find((i) => i.id === '4M-0002')!)
  await act(async () => { resolveA(trace(['M02'])); await a })
  expect(st().reach).toEqual({ red: ['HOP-1'], orange: [] })
  expect(st().feed.selected).toBe('4M-0002')
})

test('a traceable claim card opens its thread', async () => {
  vi.mocked(api.getClaim).mockResolvedValue({ id: 'CLM-0012', serial: 'MH20-0001', traceable: true } as Claim)
  render(<FeedSidebar />)
  await userEvent.click(await screen.findByRole('article', { name: 'CLM-0012' }))
  await vi.waitFor(() => expect(st().groups.main.active).toBe('thread:MH20-0001'))
})

test('a link card can be reviewed in place', async () => {
  render(<FeedSidebar />)
  const link = await screen.findByRole('article', { name: 'LINK-17' })
  await userEvent.click(within(link).getByRole('button', { name: /^Approve/ }))
  expect(api.reviewLink).toHaveBeenCalledWith(17, 'approve', undefined)
  expect(st().feed.selected).toBeNull()
})
