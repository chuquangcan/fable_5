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
