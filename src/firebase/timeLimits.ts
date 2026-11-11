/**
 * Per-class "hall time limit" — a daily budget of minutes out of the room,
 * added up across every trip a student takes in that class that day. Built
 * for students who take lots of short trips that each stay under the 10-min
 * flag but add up to far more than intended.
 *
 * Structure:
 *   teachers/{teacherId}/settings/timeLimits/
 *     black_1/ { minutes: 15, block: true }
 *     red_3/   { minutes: 20, block: false }
 *
 * - No entry for a class = feature off; tiles look exactly as before.
 * - `block: false` = show only: tiles fill up and turn red, nobody is stopped.
 * - `block: true`  = once a student's total reaches the limit, the Scanner
 *   won't let them check out again in that class today. Someone already out
 *   can always check back in, and the Dashboard's Mark Out is the teacher
 *   override (with a confirm), same as paused passes.
 *
 * Keyed by the roster key (`${day}_${periodNum}`), so it covers that class on
 * regular and late-start days. Lives under settings/ for the same reasons as
 * passHolds (see holds.ts): roster saves overwrite whole period nodes, and
 * settings/ is already open in firebase.rules.json.
 *
 * "Today" is the same day boundary the logs use (todayStr()).
 */
import { ref, set, remove, onValue } from 'firebase/database'
import { db } from './config'
import type { LogEntry } from '../types'

export interface TimeLimit {
  minutes: number
  block: boolean
}

export type TimeLimitsData = Record<string, TimeLimit>

export const TIME_LIMIT_CHOICES = [5, 10, 15, 20, 25, 30, 40, 45, 60]
export const DEFAULT_TIME_LIMIT = 15

function limitsPath(teacherId: string): string {
  return `teachers/${teacherId}/settings/timeLimits`
}

function normalizeLimits(raw: unknown): TimeLimitsData {
  const out: TimeLimitsData = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const v = val as Partial<TimeLimit> | null
    if (!v || typeof v.minutes !== 'number' || v.minutes <= 0) continue
    out[key] = { minutes: v.minutes, block: v.block === true }
  }
  return out
}

export function watchTimeLimits(
  teacherId: string,
  cb: (data: TimeLimitsData) => void,
  onError?: (err: Error) => void
): () => void {
  return onValue(
    ref(db, limitsPath(teacherId)),
    snap => cb(normalizeLimits(snap.val())),
    err => onError?.(err as unknown as Error)
  )
}

export async function setTimeLimit(teacherId: string, rosterKey: string, limit: TimeLimit): Promise<void> {
  await set(ref(db, `${limitsPath(teacherId)}/${rosterKey}`), limit)
}

export async function clearTimeLimit(teacherId: string, rosterKey: string): Promise<void> {
  await remove(ref(db, `${limitsPath(teacherId)}/${rosterKey}`))
}

// ─── Usage ────────────────────────────────────────────────────────────────────

/** Log actions that close a trip and carry its real duration. */
const TRIP_END_ACTIONS: LogEntry['action'][] = ['in', 'manual-in', 'auto-reset']

/**
 * Finished hall time today per student, for one class (`periodName` like
 * "Black1"), across regular AND late-start schedules for that day.
 * Stale resets are skipped — they have no real duration.
 */
export function finishedMsByStudent(todayLogs: LogEntry[], day: string, periodName: string): Record<string, number> {
  const m: Record<string, number> = {}
  for (const l of todayLogs) {
    if (!TRIP_END_ACTIONS.includes(l.action)) continue
    if (l.period !== periodName || !(l.schedule ?? '').startsWith(`${day}_`)) continue
    if (!l.duration || l.duration <= 0) continue
    m[l.studentName] = (m[l.studentName] ?? 0) + l.duration
  }
  return m
}

export type BudgetLevel = 'low' | 'mid' | 'high' | 'full'

/** Green under 50%, deeper green to 75%, amber to 100%, red when used up. */
export function budgetLevel(fraction: number): BudgetLevel {
  if (fraction >= 1) return 'full'
  if (fraction >= 0.75) return 'high'
  if (fraction >= 0.5) return 'mid'
  return 'low'
}

export const BUDGET_COLORS: Record<BudgetLevel, { fill: string; border: string; ink: string; sub: string }> = {
  low:  { fill: 'rgba(16,185,129,0.14)', border: '#e2e8f0',             ink: '#0f172a', sub: '#475569' },
  mid:  { fill: 'rgba(16,185,129,0.30)', border: 'rgba(16,185,129,0.45)', ink: '#065f46', sub: '#047857' },
  high: { fill: 'rgba(245,158,11,0.32)', border: 'rgba(245,158,11,0.6)',  ink: '#78350f', sub: '#b45309' },
  full: { fill: 'rgba(239,68,68,0.22)',  border: 'rgba(239,68,68,0.55)',  ink: '#991b1b', sub: '#b91c1c' },
}

/** "8 of 15 min" — rounds down so a student never sees more minutes than they've used. */
export function budgetLabel(usedMs: number, minutes: number): string {
  const used = Math.min(minutes, Math.floor(usedMs / 60000))
  return `${used} of ${minutes} min`
}
