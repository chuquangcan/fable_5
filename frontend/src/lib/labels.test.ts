import { expect, test } from 'vitest'
import { CHANNELS, channelLabel, deptLabel, docTypeLabel, formatPayload, objectTypeLabel } from './labels'

test('payload keys get English labels and units; booleans and device times are readable', () => {
  expect(formatPayload({ cycle_s: 42.1, changed: false, plc_time: '2026-11-03T13:52:38+07:00' }))
    .toBe('Cycle 42.10 s · Changed no · PLC time 13:52:38')
  expect(formatPayload({ unknown_key: 3 })).toBe('unknown_key 3')
})

test('unknown codes fall back to the code', () => {
  expect(docTypeLabel('drawing')).toBe('Drawing')
  expect(docTypeLabel('weird')).toBe('weird')
  expect(objectTypeLabel(null)).toBe('')
})

test('department labels and channels', () => {
  expect(deptLabel('maintenance')).toBe('Maintenance')
  expect(deptLabel('meeting')).toBe('Meeting')
  expect(channelLabel(CHANNELS[0])).toBe('Purchasing · ERP')
  expect(channelLabel(CHANNELS.find((c) => c.id === 'logistics')!)).toBe('Logistics')
})
