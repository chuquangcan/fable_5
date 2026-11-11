import { formatPlantTime } from './time'

test('plant time ignores machine TZ', () => {
  process.env.TZ = 'America/New_York'
  expect(formatPlantTime('2026-11-03T07:05:18Z')).toBe('11-03 14:05')
  expect(formatPlantTime('2027-02-12T09:00:00+07:00', 'YYYY-MM-DD HH:mm')).toBe('2027-02-12 09:00')
  expect(formatPlantTime('2026-11-03T07:05:18Z', 'HH:mm')).toBe('14:05')
})
