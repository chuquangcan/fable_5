import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import type { FeedItem, PlantArea, PlantState } from '../api/types'
import { threadTabId, useDemo } from '../store/demo'
import feed from '../test/fixtures/feed.json'
import plant from '../test/fixtures/plant.json'
import state from '../test/fixtures/plant_state.json'
import { TwinView } from './TwinView'

vi.mock('../api/client')

const st = () => useDemo.getState()
const node = (id: string) => screen.getByTestId(`twin-${id}`)
const items = feed as FeedItem[]

beforeEach(() => {
  try { localStorage.clear() } catch { /* no storage */ }
  st().reset()
  vi.mocked(api.getPlant).mockResolvedValue(plant as PlantArea[])
  vi.mocked(api.getPlantState).mockResolvedValue(state as PlantState)
  // unread: one alert from production, one 4M change from quality
  vi.mocked(api.getFeed).mockResolvedValue(items.filter((i) => i.id === 'AL-0001' || i.id === '4M-0001'))
  vi.mocked(api.getShipmentSerials).mockResolvedValue(['MH20-0001', 'MH20-0002'])
})

test('a machine shows its live state and cycle', async () => {
  render(<TwinView />)
  const m02 = await screen.findByTestId('twin-M02')
  expect(within(m02).getByText('warning')).toHaveClass('st', 'st-warning')
  expect(within(m02).getByText('42 s / 30 s')).toBeInTheDocument()
  expect(within(node('HOP-1')).getByText('4M watch')).toBeInTheDocument()
  expect(api.getPlantState).toHaveBeenCalledWith('2026-11-03T14:05:00+07:00')
})

test('clicking a node selects it with its line in the dock title; clicking the pane clears it', async () => {
  const { container } = render(<TwinView />)
  fireEvent.click(await screen.findByTestId('twin-M02'))  // fireEvent: d3-zoom's mousedown needs a window view jsdom lacks
  expect(st().twin.selected).toBe('M02')
  expect(st().groups.bottom.tabs.find((t) => t.id === 'object:M02')?.title).toBe('Line 1 › M02')
  expect(node('M02')).toHaveClass('sel')
  fireEvent.click(container.querySelector('.react-flow__pane')!)
  expect([st().twin.selected, st().groups.bottom.active]).toEqual([null, 'overview'])
})

test('double-clicking a shipment lists its serials; a serial opens its product tab', async () => {
  render(<TwinView />)
  fireEvent.doubleClick(await screen.findByTestId('twin-SHP-1112'))
  expect(api.getShipmentSerials).toHaveBeenCalledWith('SHP-1112')
  await userEvent.click(within(await screen.findByRole('dialog', { name: 'Serials in SHP-1112' })).getByRole('button', { name: 'MH20-0001' }))
  expect(st().groups.main.tabs.some((t) => t.id === threadTabId('MH20-0001'))).toBe(true)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('feed, department strip and twin agree', async () => {
  render(<TwinView />)
  const quality = await screen.findByRole('button', { name: /^Quality · QMS/ })
  expect(await within(quality).findByTitle('Unread from this department')).toHaveTextContent('1')
  expect(within(screen.getByRole('button', { name: /^Maintenance · CMMS/ })).queryByTitle('Unread from this department')).toBeNull()
  // the P1 alert comes from production: its chip carries the badge too (spec: card, chip and twin agree)
  expect(within(screen.getByRole('button', { name: /^Production · MES/ })).getByTitle('Unread from this department')).toHaveTextContent('1')
  await vi.waitFor(() => expect(document.querySelectorAll('[data-flow="production"]').length).toBeGreaterThan(0))
  // the flow layer runs a dotted line from the chip to each object of its unread items
  await vi.waitFor(() => expect(document.querySelectorAll('[data-flow="quality"]')).toHaveLength(2))
  await userEvent.click(quality)
  expect(st().feed.dept).toBe('quality')
  expect(node('LOT-B')).toHaveClass('dept-hl')
  expect(node('IQC-5531')).toHaveClass('dept-hl')
  expect(node('M02')).not.toHaveClass('dept-hl')
  act(() => st().setReach({ red: ['M02'], orange: ['SHP-1120'] }))
  expect(node('M02')).toHaveClass('red')
  expect(node('SHP-1120')).toHaveClass('orange')
  act(() => st().setHover(['HOP-1']))
  expect(node('HOP-1')).toHaveClass('hover')
})

test('layers: machines can be hidden, lots narrowed to those in use, alerts colouring turned off', async () => {
  render(<TwinView />)
  await screen.findByTestId('twin-M01')
  await userEvent.click(screen.getByRole('button', { name: 'Machines' }))
  expect(screen.queryByTestId('twin-M01')).toBeNull()
  expect(screen.getByTestId('twin-LOT-A')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Lots in use' }))
  expect(screen.queryByTestId('twin-LOT-A')).toBeNull()
  expect(node('LOT-B')).toBeInTheDocument()
  act(() => st().setReach({ red: ['LOT-B'], orange: [] }))
  expect(node('LOT-B')).toHaveClass('red')
  await userEvent.click(screen.getByRole('button', { name: 'Alerts' }))
  expect(node('LOT-B')).not.toHaveClass('red')
  expect(within(node('LOT-B')).queryByText('4M watch')).toBeNull()
})

test('"View on thread" with two product tabs holding the object asks which one', async () => {
  st().openProduct('MH20-0001')
  st().setThreadIds(threadTabId('MH20-0001'), ['M02'])
  st().openProduct('MH20-0457')
  st().setThreadIds(threadTabId('MH20-0457'), ['M02'])
  st().activate('main', 'twin')
  render(<TwinView />)
  const view = await screen.findByRole('button', { name: 'View on thread' })
  expect(view).toBeDisabled()
  fireEvent.click(await screen.findByTestId('twin-M02'))  // fireEvent: d3-zoom's mousedown needs a window view jsdom lacks
  await userEvent.click(view)
  const menu = screen.getByRole('menu', { name: 'Open M02 in which product tab?' })
  expect(within(menu).getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['MH20-0001', 'MH20-0457'])
  await userEvent.click(within(menu).getByRole('menuitem', { name: 'MH20-0457' }))
  expect([st().groups.main.active, st().product[threadTabId('MH20-0457')].focusNodeId]).toEqual([threadTabId('MH20-0457'), 'M02'])
  expect(st().picker).toBeNull()
})

test('a failing plant state shows an error with Retry instead of a blank pane', async () => {
  vi.mocked(api.getPlantState).mockRejectedValueOnce(new Error('500 boom'))
  render(<TwinView />)
  await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
  expect(await screen.findByTestId('twin-M02')).toBeInTheDocument()
})

test('moving the clock keeps the twin on screen instead of reloading it', async () => {
  render(<TwinView />)
  await screen.findByTestId('twin-M02')
  vi.mocked(api.getPlantState).mockImplementationOnce(() => new Promise(() => {}))
  act(() => st().setAsOf('2026-11-03T14:00:00+07:00'))
  expect(screen.getByTestId('twin-M02')).toBeInTheDocument()
  expect(api.getPlantState).toHaveBeenLastCalledWith('2026-11-03T14:00:00+07:00')
  expect(api.getPlant).toHaveBeenCalledTimes(1)
})

test('"View on thread" is disabled when no product tab holds the selected object', async () => {
  render(<TwinView />)
  fireEvent.click(await screen.findByTestId('twin-M02'))
  expect(screen.getByRole('button', { name: 'View on thread' })).toBeDisabled()
  act(() => { st().openProduct('MH20-0001'); st().setThreadIds(threadTabId('MH20-0001'), ['M02']); st().activate('main', 'twin') })
  expect(screen.getByRole('button', { name: 'View on thread' })).toBeEnabled()
})
