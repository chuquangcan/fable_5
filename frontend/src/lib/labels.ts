/** Vietnamese display labels for raw codes sent by the API. Unknown codes fall back to the code itself. */

const pick = (map: Record<string, string>) => (code: string | null | undefined) => (code ? map[code] ?? code : '')

export const docTypeLabel = pick({
  drawing: 'Bản vẽ',
  '8d_report': 'Báo cáo 8D',
  meeting_minutes: 'Biên bản họp',
  defect_report: 'Báo cáo lỗi',
  coa: 'Chứng nhận CoA',
  maintenance_report: 'Biên bản bảo trì',
  customer_email: 'Email khách hàng',
  upload: 'Tải lên',
})

export const objectTypeLabel = pick({
  supplier: 'Nhà cung cấp',
  purchase_order: 'Đơn mua',
  receipt: 'Phiếu nhập',
  lot: 'Lô linh kiện',
  supplier_lot: 'Lô NCC',
  part: 'Linh kiện',
  hopper: 'Hopper',
  machine: 'Máy',
  line: 'Line',
  serial: 'Serial',
  box: 'Thùng',
  shipment: 'Lô xuất',
  sales_order: 'Đơn bán',
  customer: 'Khách hàng',
  claim: 'Claim',
  inspection: 'IQC',
  document: 'Tài liệu',
  aggregate: 'Gộp lô',
  event: 'Sự kiện',
  source: 'Nguồn dữ liệu',
})

export const relationLabel = pick({
  mentions: 'nhắc tới',
  similar_to: 'tương tự',
  concerns: 'liên quan',
  describes: 'mô tả',
  specified_by: 'theo quy định',
  inspected: 'kiểm tra',
  about: 'về',
  part_of: 'thuộc',
  same_as: 'cùng là',
})

export const statusLabel = pick({
  confirmed: 'Đã duyệt',
  inferred: 'Tự động',
  pending: 'Chờ duyệt',
  suggested: 'Gợi ý',
  unlinked: 'Chưa gắn',
})

export const methodLabel = pick({ code: 'Khớp mã', rule: 'Quy tắc', llm: 'LLM', manual: 'Thủ công' })

export const eventTypeLabel = pick({
  press_cycle: 'Chu kỳ ép',
  maintenance: 'Bảo trì',
  shift: 'Ca làm việc',
  env_temp: 'Nhiệt độ',
  goods_receipt: 'Nhập kho',
  lot_loaded: 'Nạp lô',
})

const PAYLOAD: Record<string, string> = {
  cycle_s: 'Chu kỳ', force_kn: 'Lực ép', temp_c: 'Nhiệt độ', result: 'Kết quả', operator: 'Vận hành',
  shift: 'Ca', changed: 'Thay đổi', lot: 'Lô', serial: 'Serial', qty: 'Số lượng', hopper: 'Hopper',
  machine: 'Máy', note: 'Ghi chú', type: 'Loại', peak_force_kn: 'Lực đỉnh', plc_time: 'Giờ PLC',
}
const UNIT: Record<string, string> = { cycle_s: 's', force_kn: 'kN', peak_force_kn: 'kN', temp_c: '°C', qty: 'pcs' }
const ISO = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}:\d{2})/

function value(v: unknown): string {
  if (v === true) return 'có'
  if (v === false) return 'không'
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(2)
  if (typeof v === 'object') return JSON.stringify(v)
  const iso = ISO.exec(String(v))
  return iso ? iso[1] : String(v)  // a device timestamp next to the event time: the clock time is what differs
}

/** `{cycle_s: 42.1, changed: false}` → `Chu kỳ 42.10 s · Thay đổi không`. */
export function formatPayload(p: Record<string, unknown>): string {
  return Object.entries(p)
    .map(([k, v]) => `${PAYLOAD[k] ?? k} ${value(v)}${UNIT[k] ? ` ${UNIT[k]}` : ''}`)
    .join(' · ')
}
