/** Vietnamese display labels for raw codes sent by the API. Unknown codes fall back to the code itself. */

const pick = (map: Record<string, string>) => (code: string | null | undefined) => (code ? map[code] ?? code : '')

export const docTypeLabel = pick({
  drawing: 'Drawing',
  '8d_report': '8D report',
  meeting_minutes: 'Meeting minutes',
  defect_report: 'Defect report',
  coa: 'CoA certificate',
  maintenance_report: 'Maintenance report',
  customer_email: 'Customer email',
  upload: 'Uploaded',
})

export const objectTypeLabel = pick({
  supplier: 'Supplier',
  purchase_order: 'Purchase order',
  receipt: 'Goods receipt',
  lot: 'Component lot',
  supplier_lot: 'Supplier lot',
  part: 'Component',
  hopper: 'Hopper',
  machine: 'Machine',
  line: 'Line',
  serial: 'Serial',
  box: 'Box',
  shipment: 'Shipment',
  sales_order: 'Sales order',
  customer: 'Customer',
  claim: 'Claim',
  inspection: 'IQC',
  document: 'Document',
  aggregate: 'Lot aggregate',
  event: 'Event',
  source: 'Data source',
})

export const relationLabel = pick({
  mentions: 'mentions',
  similar_to: 'similar to',
  concerns: 'concerns',
  describes: 'describes',
  specified_by: 'specified by',
  inspected: 'inspected',
  about: 'about',
  part_of: 'part of',
  same_as: 'same as',
})

export const statusLabel = pick({
  confirmed: 'Approved',
  inferred: 'Automatic',
  pending: 'Pending review',
  suggested: 'Suggested',
  unlinked: 'Unlinked',
})

export const methodLabel = pick({ code: 'Code match', rule: 'Rule', llm: 'LLM', manual: 'Manual' })

export const eventTypeLabel = pick({
  press_cycle: 'Press cycle',
  maintenance: 'Maintenance',
  shift: 'Shift',
  env_temp: 'Temperature',
  goods_receipt: 'Goods receipt',
  lot_loaded: 'Lot loaded',
})

const PAYLOAD: Record<string, string> = {
  cycle_s: 'Cycle', force_kn: 'Press force', temp_c: 'Temperature', result: 'Result', operator: 'Operator',
  shift: 'Shift', changed: 'Changed', lot: 'Lot', serial: 'Serial', qty: 'Quantity', hopper: 'Hopper',
  machine: 'Machine', note: 'Note', type: 'Type', peak_force_kn: 'Peak force', plc_time: 'PLC time',
}
const UNIT: Record<string, string> = { cycle_s: 's', force_kn: 'kN', peak_force_kn: 'kN', temp_c: '°C', qty: 'pcs' }
const ISO = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}:\d{2})/

function value(v: unknown): string {
  if (v === true) return 'yes'
  if (v === false) return 'no'
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(2)
  if (typeof v === 'object') return JSON.stringify(v)
  const iso = ISO.exec(String(v))
  return iso ? iso[1] : String(v)  // a device timestamp next to the event time: the clock time is what differs
}

/** `{cycle_s: 42.1, changed: false}` → `Cycle 42.10 s · Changed no`. */
export function formatPayload(p: Record<string, unknown>): string {
  return Object.entries(p)
    .map(([k, v]) => `${PAYLOAD[k] ?? k} ${value(v)}${UNIT[k] ? ` ${UNIT[k]}` : ''}`)
    .join(' · ')
}

/** Departments: mirror of backend/onethread/departments.py (test_departments.py checks they agree). */
export const DEPT_OF_STAGE: Record<string, string> = {
  cung_ung: 'purchasing',
  kho: 'warehouse',
  san_xuat: 'production',
  dinh_kem: 'quality',
  logistics: 'logistics',
  khach_hang: 'logistics',
  hau_mai: 'quality',
}

export const DEPT_OF_SOURCE: Record<string, string> = {
  ERP: 'purchasing',
  WMS: 'warehouse',
  QMS: 'quality',
  PLM: 'design',
  CMMS: 'maintenance',
  PLC1: 'production',
  PLC2: 'production',
  PLC3: 'production',
  MES: 'production',
  'ENV-L1': 'production',
  HR: 'production',
  Meeting: 'meeting',
}

export interface Channel { id: string; dept: string; system: string | null }

/** One chip per department and system on the plant twin's department strip. */
export const CHANNELS: Channel[] = [
  { id: 'purchasing', dept: 'purchasing', system: 'ERP' },
  { id: 'quality', dept: 'quality', system: 'QMS' },
  { id: 'design', dept: 'design', system: 'PLM' },
  { id: 'warehouse', dept: 'warehouse', system: 'WMS' },
  { id: 'maintenance', dept: 'maintenance', system: 'CMMS' },
  { id: 'logistics', dept: 'logistics', system: null },
  { id: 'meeting', dept: 'meeting', system: null },
]

export const deptLabel = pick({
  purchasing: 'Purchasing',
  quality: 'Quality',
  production: 'Production',
  warehouse: 'Warehouse',
  logistics: 'Logistics',
  design: 'Design',
  maintenance: 'Maintenance',
  meeting: 'Meeting',
})

export const channelLabel = (c: Channel) => (c.system ? `${deptLabel(c.dept)} · ${c.system}` : deptLabel(c.dept))
