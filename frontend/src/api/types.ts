// Mirrors the pydantic response models in backend/onethread/queries/*
export type EdgeStatus = 'confirmed' | 'inferred' | 'pending' | 'suggested'

export interface Claim {
  id: string
  name: string
  status: string
  symptom: string | null
  customer_id: string | null
  customer_name: string | null
  serial: string | null
  received: string | null
}

export interface TraceNode {
  id: string
  type: string
  name: string
  attributes: Record<string, unknown>
}

export interface Edge {
  from_id: string
  to_id: string
  relation: string
  tier: number
  status: EdgeStatus
  score: number | null
}

export interface TraceGraph {
  root: string
  nodes: TraceNode[]
  edges: Edge[]
}

export interface LinkView extends Edge {
  other_id: string
  other_name: string
  direction: 'in' | 'out'
}

export interface PlantEvent {
  event_id: string
  type: string
  object_ids: string[]
  event_time: string
  time_kind: 'sensor' | 'transaction' | 'effective'
  source: string
  source_record_id: string | null
  payload: Record<string, unknown>
}

export interface DocView {
  doc_id: string
  page: number | null
  type: string
  text: string
  extracted_codes: string[]
  tier: number
  status: EdgeStatus
  score: number | null
}

export interface MetricValue {
  object_id: string
  value: number | null
  source_record_id: string | null
}

export interface LotStat {
  lot: string
  n: number
  cycle_mean_s: number
  force_mean_kn: number
  first: string
  last: string
}

export interface ShipmentImpact {
  id: string
  customer_id: string | null
  customer_name: string | null
  parts: number
  boxes: number
  status: string | null
  date: string | null
}

export interface Impact {
  lot: string
  parts: number
  boxes: number
  shipments: ShipmentImpact[]
  delivered_shipments: number
  delivered_parts: number
  held_parts: number
}

export type ReportSegment = { kind: 'text'; text: string } | { kind: 'cite'; label: string; target_id: string | null }

export interface ReportDraft {
  id: string
  title: string
  subtitle: string
  summary: ReportSegment[]
  chain: { id: string; label: string; tone: 'bad' | 'suspect' | 'neutral' }[]
  impact: Impact
  cause: ReportSegment[]
  actions: string[]
}

/** Raw stage codes sent by /api/flow; display labels live in thread/flowLayout.ts (STAGES). */
export type FlowStage = 'cung_ung' | 'kho' | 'san_xuat' | 'logistics' | 'khach_hang' | 'hau_mai' | 'dinh_kem'

export interface FlowNode {
  id: string
  type: string
  name: string
  stage: string
  sub: string
  /** Spine column index; for branch nodes, the spine column they sit under. */
  order: number | null
  row: number
  parent_id: string | null
  members: Record<string, number> | null
}

export interface FlowEdge {
  up: string
  down: string
  relation: string
  tier: number
  status: EdgeStatus
  kind: 'spine' | 'branch'
  active: boolean
}

export interface Attachment {
  id: string
  kind: 'document' | 'inspection' | 'claim' | 'event' | 'alias' | 'part'
  label: string
  status: EdgeStatus | null
  tier: number | null
  via: string | null
}

export interface FlowGraph {
  root: string
  at: string
  spine: FlowNode[]
  branches: FlowNode[]
  edges: FlowEdge[]
  /** Keyed per node; the same attachment id may appear under several nodes. */
  attachments: Record<string, Attachment[]>
}

export interface Param {
  label: string
  value: string | number
  unit: string | null
  source: string
  source_record_id: string | null
}

export interface NodeSummary {
  id: string
  type: string
  name: string
  /** Raw stage code (see FlowStage). */
  stage: string
  aliases: string[]
  params: Param[]
  docs: DocView[]
  counts: { links: number; events: number }
}

export interface Mark {
  id: string
  reason: string
}

/** Fault trace from an origin: red = origin + upstream, orange = downstream that may be affected. */
export interface FaultTrace {
  origin: string
  at: string
  red: Mark[]
  orange: Mark[]
}
