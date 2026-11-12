import { getFeed } from '../api/client'
import type { FeedItem } from '../api/types'
import { type Async, useAsync } from '../evidence/useAsync'
import { type FeedFilter, useDemo } from '../store/demo'

let cache: { version: number; items: Promise<FeedItem[]> } | null = null

/** One request per data version, shared by the rail, the activity badge and the department strip. */
function loadFeed(version: number): Promise<FeedItem[]> {
  if (!cache || cache.version !== version) {
    const items = getFeed()
    cache = { version, items }
    items.catch(() => { if (cache?.items === items) cache = null })  // a failure is retried, not cached
  }
  return cache.items
}

export function useFeed(): Async<FeedItem[]> {
  const version = useDemo((s) => s.dataVersion)
  return useAsync(() => loadFeed(version), [version])
}

/** Items of one kind (or all), sent or to be acted on by `dept` (or any department). */
export function feedFilter(items: FeedItem[], kind: FeedFilter, dept: string | null): FeedItem[] {
  return items.filter((i) => (kind === 'all' || i.kind === kind) && (!dept || i.sender === dept || i.acting.includes(dept)))
}
