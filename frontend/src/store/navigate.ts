import { getClaim, getLinks } from '../api/client'
import type { DemoState } from './demo'

type Get = () => DemoState
type Set = (p: Partial<DemoState>) => void

const isDoc = (id: string) => /^D-/.test(id)
const isSerial = (id: string) => /^MH20-/.test(id)
const isBox = (id: string) => /^BOX-/.test(id)
const isClaim = (id: string) => /^CLM-/.test(id)

/** The single navigation entry (spec §1): opens or focuses the tab where `id` is best shown. */
export async function goTo(get: Get, id: string): Promise<void> {
  const s = get()
  if (isDoc(id)) return s.openDoc(id)
  if (isSerial(id)) { s.openProduct(id); return }
  if (isBox(id)) {
    const links = await getLinks(id).catch(() => [])
    const serial = links.find((l) => l.relation === 'packed_in' && l.to_id === id && isSerial(l.from_id))?.from_id
    if (serial) get().openProduct(serial)
    return
  }
  if (isClaim(id)) {
    const claim = await getClaim(id).catch(() => null)
    if (claim?.traceable && claim.serial) get().openClaim(id, claim.serial)
    return
  }
  // any other object: its own tab in the dock, and selected in the main tab when that tab shows it
  const main = s.groups.main.tabs.find((t) => t.id === s.groups.main.active)
  if (main?.kind === 'twin') return s.selectTwin(id)
  const p = main?.kind === 'thread' ? s.product[main.id] : undefined
  if (main && p?.threadIds.includes(id)) return s.selectNode(main.id, id)
  s.openTab('bottom', { id: `object:${id}`, kind: 'object', target: id, title: id }, { preview: true })
}

/** "View on thread": the product tab whose thread contains `id`; several → ask which (spec §2). */
export function viewOnThread(get: Get, set: Set, id: string): void {
  const s = get()
  const tabIds = s.groups.main.tabs.filter((t) => t.kind === 'thread' && s.product[t.id]?.threadIds.includes(id)).map((t) => t.id)
  if (tabIds.length === 1) {
    s.activate('main', tabIds[0])
    get().selectNode(tabIds[0], id)
  } else if (tabIds.length > 1) set({ picker: { id, tabIds } })
}
