export const DEMO_NOW = '2027-02-12T09:00:00+07:00'

export type PlantTimeFormat = 'MM-DD HH:mm' | 'YYYY-MM-DD HH:mm' | 'HH:mm'

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', // plant time, UTC+7, regardless of the machine's TZ
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function formatPlantTime(iso: string, fmt: PlantTimeFormat = 'MM-DD HH:mm'): string {
  const p = Object.fromEntries(formatter.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  const hm = `${p.hour}:${p.minute}`
  if (fmt === 'HH:mm') return hm
  const md = `${p.month}-${p.day}`
  return fmt === 'YYYY-MM-DD HH:mm' ? `${p.year}-${md} ${hm}` : `${md} ${hm}`
}
