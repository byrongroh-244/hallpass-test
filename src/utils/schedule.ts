import { SCHEDULES } from '../data/schedules'
import type { ScheduleDay, StartType, Period } from '../types'

export const MAX_OUT = 5

export function getCurrentPeriod(day: ScheduleDay, start: StartType): Period | null {
  const now = new Date()
  const t = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`
  return SCHEDULES[day][start].find(p => t >= p.startTime && t < p.endTime) ?? null
}

export function buildScheduleString(day: ScheduleDay, start: StartType) {
  return `${day}_${start}`
}

export function buildStudentKey(day: ScheduleDay, start: StartType, name: string, period: string) {
  return `${day}_${start}_${name.replace(/\s+/g,'_')}_${period.replace(/\s+/g,'_')}`
}

export function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export function fmtDuration(ms: number): string {
  const m = Math.floor(ms / 60000)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

export function fmt12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function extractPeriodNumber(name: string): string {
  return name.match(/\d+/)?.[0] ?? '1'
}
