import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { threadTabId, useDemo } from '../store/demo'
import { TabBar } from './TabBar'

vi.mock('../api/client')

const s = () => useDemo.getState()
const tab = (name: string) => screen.getByRole('tab', { name })

beforeEach(() => {
  try { localStorage.clear() } catch { /* no storage */ }
  s().reset()
})

test('pinned tabs have no close button; others do; the active tab is selected', () => {
  s().openProduct('MH20-0457')
  render(<TabBar group="main" />)
  expect(screen.queryByRole('button', { name: 'Close Plant' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Close Thread · MH20-0457' })).toBeInTheDocument()
  expect(tab('Thread · MH20-0457')).toHaveAttribute('aria-selected', 'true')
  fireEvent.click(tab('Plant'))
  expect(s().groups.main.active).toBe('twin')
})

test('the close button and a middle click close a tab', () => {
  s().openProduct('MH20-0457')
  s().openProduct('MH20-0002')
  render(<TabBar group="main" />)
  fireEvent.click(screen.getByRole('button', { name: 'Close Thread · MH20-0457' }))
  expect(s().groups.main.tabs.map((t) => t.id)).toEqual(['twin', threadTabId('MH20-0002')])
  fireEvent(tab('Thread · MH20-0002'), new MouseEvent('auxclick', { bubbles: true, button: 1 }))
  expect(s().groups.main.tabs.map((t) => t.id)).toEqual(['twin'])
})

test('a middle click on a pinned tab does nothing', () => {
  render(<TabBar group="main" />)
  fireEvent(tab('Plant'), new MouseEvent('auxclick', { bubbles: true, button: 1 }))
  expect(s().groups.main.tabs.map((t) => t.id)).toEqual(['twin'])
})

test('a preview tab is italic until double-clicked', () => {
  void s().goTo('M02')
  render(<TabBar group="bottom" />)
  const wrap = tab('M02').closest('.tab')!
  expect(wrap).toHaveClass('preview')
  fireEvent.doubleClick(tab('M02'))
  expect(tab('M02').closest('.tab')).not.toHaveClass('preview')
})

test('dragging a tab onto another reorders the group', () => {
  render(<TabBar group="bottom" />)
  fireEvent.dragStart(tab('Review queue'))
  fireEvent.dragOver(tab('Data sources'))
  fireEvent.drop(tab('Data sources'))
  expect(s().groups.bottom.tabs.map((t) => t.id)).toEqual(['overview', 'review', 'table:sources'])
})

test('the dock tab bar collapses and splits the dock', () => {
  render(<TabBar group="bottom" />)
  fireEvent.click(screen.getByRole('button', { name: 'Collapse panel' }))
  expect(s().layout.dockCollapsed).toBe(true)
  fireEvent.click(tab('Review queue'))
  fireEvent.click(screen.getByRole('button', { name: 'Split panel' }))
  expect(s().layout.split).toBe(true)
  expect(s().groups.bottom2.tabs.map((t) => t.id)).toEqual(['review'])
})
