import { expect, test } from 'vitest'
import { closeIn, type Group, keepIn, moveIn, openIn } from './tabs'

const t = (id: string, pinned = false) => ({ id, kind: 'object' as const, target: id, title: id, pinned })
const ids = (g: Group) => g.tabs.map((x) => x.id)
const empty: Group = { tabs: [], active: null }

test('opening a new tab appends and activates it; an open id is only activated', () => {
  let g = openIn(openIn(empty, t('a')), t('b'))
  expect([ids(g), g.active]).toEqual([['a', 'b'], 'b'])
  g = openIn(g, t('a'))
  expect([ids(g), g.active]).toEqual([['a', 'b'], 'a'])
})

test('a preview tab replaces the previous preview in place', () => {
  let g = openIn(openIn(openIn(empty, t('a')), t('p1'), { preview: true }), t('c'))
  g = openIn(g, t('p2'), { preview: true })
  expect(ids(g)).toEqual(['a', 'p2', 'c'])
  expect(g.tabs[1].preview).toBe(true)
  expect(g.active).toBe('p2')
})

test('opening a preview id for keeps clears the preview flag; keepIn does too', () => {
  let g = openIn(empty, t('p'), { preview: true })
  g = openIn(g, t('p'))
  expect(g.tabs[0].preview).toBe(false)
  g = openIn(g, t('q'), { preview: true })
  expect(keepIn(g, 'q').tabs[1].preview).toBe(false)
})

test('re-opening the current preview as a preview keeps it a preview', () => {
  const g = openIn(openIn(empty, t('p'), { preview: true }), t('p'), { preview: true })
  expect([ids(g), g.tabs[0].preview]).toEqual([['p'], true])
})

test('activate: false opens without changing the active tab', () => {
  const g = openIn(openIn(empty, t('a')), t('b'), { activate: false })
  expect([ids(g), g.active]).toEqual([['a', 'b'], 'a'])
})

test('closing a pinned tab does nothing; closing the active tab activates the right, then the left neighbour', () => {
  const g = openIn(openIn(openIn(empty, t('pin', true)), t('b')), t('c'))
  expect(closeIn(g, 'pin')).toBe(g)
  const mid = closeIn({ ...g, active: 'b' }, 'b')
  expect([ids(mid), mid.active]).toEqual([['pin', 'c'], 'c'])
  const last = closeIn(g, 'c')
  expect(last.active).toBe('b')
  expect(closeIn(openIn(empty, t('x')), 'x').active).toBeNull()
})

test('closing an inactive tab keeps the active one', () => {
  const g = openIn(openIn(empty, t('a')), t('b'))
  expect(closeIn(g, 'a').active).toBe('b')
})

test('moveIn puts the dragged tab where the target was', () => {
  const g = openIn(openIn(openIn(empty, t('a')), t('b')), t('c'))
  expect(ids(moveIn(g, 'c', 'a'))).toEqual(['c', 'a', 'b'])
  expect(ids(moveIn(g, 'a', 'c'))).toEqual(['b', 'c', 'a'])
  expect(moveIn(g, 'a', 'a')).toBe(g)
})
