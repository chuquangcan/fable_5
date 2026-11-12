import { getClaimFault, getFault, getImpact } from '../api/client'
import type { FaultTrace, FeedItem } from '../api/types'

export interface Reach { red: string[]; orange: string[] }
export const NO_REACH: Reach = { red: [], orange: [] }

const isLot = (id: string) => /^LOT-/.test(id)

/** What a feed card reaches on the twin: red from the fault trace, orange from the trace and the lot's impact.
 *  Any failure gives an empty reach (Review Focus #4). */
export async function reachOf(item: FeedItem): Promise<Reach> {
  const origin = item.objects[0]
  const lot = item.objects.find(isLot)
  const fault: Promise<FaultTrace | null> =
    item.kind === 'claim' ? getClaimFault(item.ref.claim_id ?? item.id) : origin ? getFault(origin, item.at) : Promise.resolve(null)
  try {
    const [t, impact] = await Promise.all([fault, lot ? getImpact(lot) : Promise.resolve(null)])
    const orange = [...(t?.orange.map((m) => m.id) ?? []), ...(impact?.shipments.map((s) => s.id) ?? [])]
    return { red: t?.red.map((m) => m.id) ?? [], orange: [...new Set(orange)] }
  } catch {
    return NO_REACH
  }
}
