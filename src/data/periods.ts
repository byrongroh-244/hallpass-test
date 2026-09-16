/**
 * Period times — these never change year to year.
 * Only the class names and student rosters change (managed via the Editor).
 */

export interface PeriodTime {
  period: 1 | 2 | 3 | 4
  regular: { start: string; end: string }
  late:    { start: string; end: string }
}

export const PERIOD_TIMES: PeriodTime[] = [
  { period: 1, regular: { start: '08:25', end: '09:45' }, late: { start: '09:35', end: '10:50' } },
  { period: 2, regular: { start: '10:40', end: '12:00' }, late: { start: '11:05', end: '12:20' } },
  { period: 3, regular: { start: '12:50', end: '14:10' }, late: { start: '13:00', end: '14:15' } },
  { period: 4, regular: { start: '14:15', end: '15:35' }, late: { start: '14:20', end: '15:35' } },
]

export function fmt12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
