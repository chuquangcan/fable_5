import type {
  AttachResult, Claim, LotCompare, MachineWindow, DocDetail, DocRow, DocView, FaultTrace, FlowGraph, Impact, LinkView, LotStat, MetricValue, NodeSummary,
  PlantArea, PlantEvent, ProviderInfo, ReportDraft, ReviewDecision, ReviewQueue, ReviewRecord, SearchHit, TableInfo, TablePage, TraceGraph,
} from './types'

export async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { detail?: string })
    throw new Error(`${res.status} ${(body as { detail?: string }).detail ?? res.statusText}`)
  }
  return res.json() as Promise<T>
}

async function sendJSON<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { detail?: string })
    throw new Error(`${res.status} ${(body as { detail?: string }).detail ?? res.statusText}`)
  }
  return res.json() as Promise<T>
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

const enc = encodeURIComponent

export const getClaims = () => getJSON<Claim[]>('/api/claims')
export const getClaim = (id: string) => getJSON<Claim>(`/api/claims/${enc(id)}`)
export const getFlow = (id: string) => getJSON<FlowGraph>(`/api/flow/${enc(id)}`)
export const getTrace = (serial: string) => getJSON<TraceGraph>(`/api/trace/${enc(serial)}`)
export const getEvents = (objectId: string, start?: string, end?: string, type?: string, limit?: number) =>
  getJSON<PlantEvent[]>(`/api/objects/${enc(objectId)}/events${qs({ start, end, type, limit })}`)
export const getLinks = (objectId: string, statuses?: string[]) =>
  getJSON<LinkView[]>(`/api/objects/${enc(objectId)}/links${qs({ status: statuses?.join(',') })}`)
export const getDocs = (objectId: string, at?: string) =>
  getJSON<DocView[]>(`/api/objects/${enc(objectId)}/docs${qs({ at })}`)
export const getMetric = (kpi: 'cpk' | 'cycle_time', objects: string[], start?: string, end?: string) =>
  getJSON<MetricValue[]>(`/api/metrics/${kpi}${qs({ objects: objects.join(','), start, end })}`)
export const getCompare = (machine: string, day: string) =>
  getJSON<LotStat[]>(`/api/compare/${enc(machine)}${qs({ day })}`)
export const getImpact = (lot: string) => getJSON<Impact>(`/api/impact/${enc(lot)}`)
export const getReportDraft = (claimId: string) => getJSON<ReportDraft>(`/api/reports/${enc(claimId)}/draft`)
export const getSummary = (id: string) => getJSON<NodeSummary>(`/api/objects/${enc(id)}/summary`)
export const getClaimFault = (claimId: string) => getJSON<FaultTrace>(`/api/claims/${enc(claimId)}/fault-trace`)
/** `thread` (serial or claim id) keeps that thread's serial/boxes uncollapsed so marks match the drawn spine. */
export const getFault = (origin: string, at?: string, thread?: string) =>
  getJSON<FaultTrace>(`/api/fault-trace${qs({ origin, at, thread })}`)

export function uploadDocument(file: File, targetHint?: string): Promise<AttachResult> {
  const form = new FormData()
  form.append('file', file)
  if (targetHint) form.append('target_hint', targetHint)
  return sendJSON<AttachResult>('/api/documents', { method: 'POST', body: form })
}
export const listSamples = () => getJSON<string[]>('/api/documents/samples')
export const attachSample = (name: string) => sendJSON<AttachResult>(`/api/documents/samples/${enc(name)}`, { method: 'POST' })
export const resetDemoData = () => sendJSON<{ removed: number; reviews: number }>('/api/demo/reset', { method: 'POST' })

export const listDocuments = (f: { q?: string; type?: string; status?: string; source?: string } = {}) =>
  getJSON<DocRow[]>(`/api/documents${qs(f)}`)
export const getDocument = (id: string) => getJSON<DocDetail>(`/api/documents/${enc(id)}`)
/** Original bytes of an uploaded document (seeded docs have none: their originals live in the source system). */
export const documentFileUrl = (id: string) => `/api/documents/${enc(id)}/file`
export const getReviewQueue = () => getJSON<ReviewQueue>('/api/review-queue')
export const reviewLink = (linkId: number, decision: ReviewDecision, note?: string) =>
  sendJSON<ReviewRecord>(`/api/links/${linkId}/review`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, note: note || null }),
  })
export const getPlant = () => getJSON<PlantArea[]>('/api/plant')
export const getTables = () => getJSON<TableInfo[]>('/api/db/tables')
export const getTable = (name: string, q?: string, limit = 50, offset = 0) =>
  getJSON<TablePage>(`/api/db/tables/${enc(name)}${qs({ q: q || undefined, limit, offset })}`)
export const search = (q: string) => getJSON<SearchHit[]>(`/api/search${qs({ q })}`)
export const getProvider = () => getJSON<ProviderInfo>('/api/agent/provider')
export const getMachineWindow = (id: string) => getJSON<MachineWindow>(`/api/machines/${enc(id)}/cycle-window`)
export const getLotCompare = (id: string) => getJSON<LotCompare>(`/api/lots/${enc(id)}/compare`)
