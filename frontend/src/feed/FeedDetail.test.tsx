import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import * as api from '../api/client'
import type { DocDetail, FeedItem, LinkView } from '../api/types'
import { useDemo } from '../store/demo'
import feed from '../test/fixtures/feed.json'
import { FeedDetail } from './FeedDetail'

vi.mock('../api/client')

const st = () => useDemo.getState()

beforeEach(() => {
  st().reset()
  vi.mocked(api.getFeed).mockResolvedValue(feed as FeedItem[])
  vi.mocked(api.getDocument).mockResolvedValue({
    doc_id: 'D-12', type: 'drawing', source: 'PLM', pages: [7], file_uri: null, has_file: false, uploaded: false, effective_from: null,
    excerpt: '', codes: ['BRG-6203'], status: 'confirmed',
    links: [{ link_id: 3, other_id: 'IQC-5531', relation: 'about', tier: 1, status: 'confirmed', score: 0.97 }],
    chunks: [{ chunk_id: 'D-12-p7', page: 7, text: 'Bearing BRG-6203 press fit: interference 8–15 µm.', extracted_codes: ['BRG-6203'] }],
    review_links: [], history: [],
  } as unknown as DocDetail)
  vi.mocked(api.getLinks).mockResolvedValue([
    { link_id: 9, from_id: 'HOP-1', to_id: 'M02', relation: 'fed_into', tier: 1, status: 'confirmed', score: null, other_id: 'HOP-1', other_name: 'Hopper 1', direction: 'in' },
  ] as unknown as LinkView[])
})

test('a document card marks its extracted codes and lists what it is linked to', async () => {
  const { container } = render(<FeedDetail id="D-12" />)
  expect(await screen.findByText('BRG-6203', { selector: 'mark' })).toBeInTheDocument()
  expect(container.querySelector('mark')?.textContent).toBe('BRG-6203')
  const row = screen.getByRole('row', { name: /IQC-5531/ })
  expect(within(row).getByText('about')).toBeInTheDocument()
  expect(within(row).getByText('Approved')).toBeInTheDocument()
  expect(within(row).getByText('0.97')).toBeInTheDocument()
  await userEvent.click(within(row).getByRole('button', { name: 'IQC-5531' }))
  expect(st().twin.selected).toBe('IQC-5531')
})

test('a notice shows its title and reason, the first object links, and the reach of the selected card', async () => {
  useDemo.setState({ feed: { ...st().feed, selected: 'AL-0001' }, reach: { red: ['M02', 'LOT-B'], orange: ['SHP-1120'] } })
  render(<FeedDetail id="AL-0001" />)
  expect(await screen.findByText(/M02 cycle/)).toBeInTheDocument()
  expect(api.getLinks).toHaveBeenCalledWith('M02')
  expect(await screen.findByRole('row', { name: /HOP-1/ })).toBeInTheDocument()
  expect(within(screen.getByRole('row', { name: /SHP-1120/ })).getByText('fault reach')).toBeInTheDocument()
  expect(api.getDocument).not.toHaveBeenCalled()
})

test('an item no longer in the feed says so', async () => {
  render(<FeedDetail id="AL-9999" />)
  expect(await screen.findByText('This item is no longer in the feed')).toBeInTheDocument()
})

test('the reach of another card is not shown on this one', async () => {
  useDemo.setState({ feed: { ...st().feed, selected: '4M-0002' }, reach: { red: ['HOP-1'], orange: ['SHP-1120'] } })
  render(<FeedDetail id="AL-0001" />)
  expect(await screen.findByRole('row', { name: /HOP-1/ })).toBeInTheDocument()
  expect(screen.queryByText('fault reach')).toBeNull()
})
