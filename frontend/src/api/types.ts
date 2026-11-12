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
  /** The claim's serial exists in the data, so its thread can be opened. */
  traceable: boolean
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

export type AttachMethod = 'code' | 'rule' | 'llm' | 'manual'

export interface AttachLink {
  to_id: string
  tier: number
  status: string
  score: number
}

export interface AttachResult {
  doc_id: string
  type: string
  method: AttachMethod
  links: AttachLink[]
  reason: string
  duplicate: boolean
}

// ---- review, document store, plant, raw tables, search (backend: review.py, queries/repository.py, queries/plant.py)

export type ReviewDecision = 'approve' | 'reject'
/** Statuses a person can still approve or reject. */
export const REVIEWABLE: readonly string[] = ['inferred', 'pending', 'suggested']

export interface ReviewItem {
  link_id: number
  from_id: string
  from_name: string
  from_type: string
  to_id: string
  to_name: string
  to_type: string
  relation: string
  tier: number
  status: EdgeStatus
  score: number | null
  method: string | null
  reason: string | null
  doc_id: string | null
}

export interface ReviewRecord {
  review_id: number
  link_id: number
  decision: ReviewDecision
  from_status: EdgeStatus
  reviewer: string
  note: string | null
  reviewed_at: string
  from_id: string
  to_id: string
  relation: string
}

export interface ReviewQueue {
  pending: ReviewItem[]
  decided: ReviewRecord[]
}

export interface DocLinkRef {
  link_id: number
  other_id: string
  relation: string
  tier: number
  status: EdgeStatus
  score: number | null
}

export type DocStatus = EdgeStatus | 'unlinked'

export interface DocRow {
  doc_id: string
  type: string
  source: string | null
  pages: number[]
  file_uri: string | null
  has_file: boolean
  uploaded: boolean
  effective_from: string | null
  excerpt: string
  codes: string[]
  status: DocStatus
  links: DocLinkRef[]
}

export interface DocDetail extends DocRow {
  chunks: { chunk_id: string; page: number | null; text: string; extracted_codes: string[] }[]
  review_links: ReviewItem[]
  history: ReviewRecord[]
}

export interface Asset {
  id: string
  type: string
  name: string
  sub: string
  events: number
  docs: number
  to_review: number
}

export interface PlantArea {
  id: string
  label: string
  groups: { type: string; label: string; items: Asset[] }[]
  volume: string | null
}

export interface TableInfo {
  name: string
  rows: number
  columns: string[]
}

export interface TablePage {
  name: string
  columns: string[]
  total: number
  offset: number
  limit: number
  rows: Record<string, unknown>[]
}

export interface SearchHit {
  id: string
  kind: 'object' | 'document'
  type: string
  name: string
}

export interface ProviderInfo {
  provider: string | null
  model: string | null
  mode: string
}

// ---- generic analyses (backend: queries/analysis.py)

export interface MachineWindow {
  machine: string
  name: string
  day: string | null
  start: string | null
  end: string | null
  cycle_source: string | null
  target_s: number | null
  line: string | null
  hoppers: string[]
  change: { time: string; lot: string; hopper: string; source: string; source_record_id: string | null } | null
  offset_s: number | null
}

export interface LotRow {
  lot: string
  received_at: string | null
  receipt: string | null
  supplier: string | null
  iqc: string | null
  cpk: number | null
  verdict: string | null
  spec_min: number | null
  spec_doc: string | null
  spec_page: number | null
}

export interface SimilarClaim {
  id: string
  period: string | null
  symptom: string | null
  resolution: string | null
  via: string
  tier: number
  status: EdgeStatus
  docs: string[]
}

export interface LotCompare {
  lot: string
  part: string | null
  part_name: string | null
  rows: LotRow[]
  similar: SimilarClaim[]
}

export interface FeedRef { doc_id: string | null; link_id: number | null; claim_id: string | null }

/** One card of the notifications & changes feed (/api/feed), newest first. */
export interface FeedItem {
  id: string
  kind: 'alert' | '4m' | 'doc' | 'link' | 'claim'
  badge: string
  /** Plant time (UTC+7) the item happened. */
  at: string
  title: string
  reason: string
  /** Department that sent it; null when no department is known. */
  sender: string | null
  /** Departments that must act. */
  acting: string[]
  objects: string[]
  status: 'proposed' | 'watching' | 'approved' | 'closed'
  ref: FeedRef
}

export type TwinState = 'running' | 'stopped' | 'warning' | 'watch4m' | 'idle'
export interface NodeState { state: TwinState; value: string; sub: string | null }
export interface TwinEdge { from_id: string; to_id: string; relation: string; status: EdgeStatus }
/** Live state of the plant at one moment (/api/plant/state?at=). */
export interface PlantState { at: string; nodes: Record<string, NodeState>; edges: TwinEdge[] }

export interface Kpis { output: number; cycle_s: number | null; target_s: number | null; open_alerts: number; watch_4m: number; pending_links: number }
export interface OverviewRow {
  id: string; kind: 'line' | 'machine'; name: string; line: string | null; state: TwinState
  cycle_s: number | null; target_s: number | null; output: number; lot: string | null; trend: number[]
}
export interface ShipmentRisk { id: string; status: string | null; date: string | null; customer: string | null; parts: number; risk: 'high' | 'none'; reason: string }
export interface SourceRow { source: string; dept: string | null; events: number; last_at: string | null; delay_s: number | null }
/** Plant overview at one moment (/api/plant/overview?at=). */
export interface PlantOverview { at: string; kpis: Kpis; rows: OverviewRow[]; shipments: ShipmentRisk[]; sources: SourceRow[] }
