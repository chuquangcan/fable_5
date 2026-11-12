import type { DocView } from '../api/types'

const uploadNo = (id: string) => (id.startsWith('D-U') ? Number(id.slice(3)) : 0)

/** Newest uploads first, then by tier (most reliable first), then id. */
export const sortDocs = (docs: DocView[]) =>
  [...docs].sort((a, b) => uploadNo(b.doc_id) - uploadNo(a.doc_id) || a.tier - b.tier || a.doc_id.localeCompare(b.doc_id))
