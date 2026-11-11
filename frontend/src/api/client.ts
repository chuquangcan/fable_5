import type { Claim, DocView, FaultTrace, FlowGraph, Impact, LinkView, LotStat, MetricValue, NodeSummary, PlantEvent, ReportDraft, TraceGraph } from './types'

export async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path)
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
export const getFault = (origin: string, at?: string) => getJSON<FaultTrace>(`/api/fault-trace${qs({ origin, at })}`)
