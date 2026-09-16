/**
 * Typed Firebase write helpers.
 * All student and log writes go through here — one place to change field names,
 * key format, or data shape.
 *
 * Every function takes a `teacherId` and writes under that teacher's own
 * subtree (teachers/{teacherId}/students, teachers/{teacherId}/logs) so two
 * teachers' classes — even ones that happen to share a period name like
 * "Red1" — never collide.
 */
import { ref, set, push, serverTimestamp, runTransaction } from 'firebase/database'
import { db } from './config'
import type { ScheduleDay, StartType } from '../types'

// ─── Key builders ─────────────────────────────────────────────────────────────

/** Firebase key for a student record: red_regular_Liam_Red1-Algebra */
export function studentKey(day: ScheduleDay, start: StartType, name: string, period: string): string {
  const safeName = name.replace(/[.#$[\]/]/g, '_')
  const safePeriod = period.replace(/[.#$[\]/]/g, '_')
  return `${day}_${start}_${safeName}_${safePeriod}`
}

/** Schedule string stored on every record for filtering: "red_regular" */
export function scheduleStr(day: ScheduleDay, start: StartType): string {
  return `${day}_${start}`
}

// ─── Write helpers ────────────────────────────────────────────────────────────

interface ScanOutParams {
  teacherId: string
  day: ScheduleDay; start: StartType
  name: string; period: string
  outTime: number; date: string
}

export async function writeStudentOut({ teacherId, day, start, name, period, outTime, date }: ScanOutParams) {
  const key = studentKey(day, start, name, period)
  const sched = scheduleStr(day, start)
  await set(ref(db, `teachers/${teacherId}/students/${key}`), {
    name, period, schedule: sched, status: 'out',
    timestamp: serverTimestamp(), outTimestamp: serverTimestamp(),
  })
  await push(ref(db, `teachers/${teacherId}/logs`), {
    studentName: name, period, schedule: sched, action: 'out',
    timestamp: serverTimestamp(), date,
    outTime, inTime: null, duration: null,
  })
}

interface ScanInParams {
  teacherId: string
  day: ScheduleDay; start: StartType
  name: string; period: string
  outStart: number; inTime: number; date: string
}

export async function writeStudentIn({ teacherId, day, start, name, period, outStart, inTime, date }: ScanInParams) {
  const key = studentKey(day, start, name, period)
  const sched = scheduleStr(day, start)
  await set(ref(db, `teachers/${teacherId}/students/${key}`), {
    name, period, schedule: sched, status: 'in',
    timestamp: serverTimestamp(), outTimestamp: null,
  })
  await push(ref(db, `teachers/${teacherId}/logs`), {
    studentName: name, period, schedule: sched, action: 'in',
    timestamp: serverTimestamp(), date,
    outTime: outStart, inTime, duration: inTime - outStart,
  })
}

interface ManualParams {
  teacherId: string
  day: ScheduleDay; start: StartType
  name: string; period: string
  action: 'manual-in' | 'manual-out'
  outStart: number | null; inTime: number | null
  now: number; date: string
}

export async function writeManualAction({ teacherId, day, start, name, period, action, outStart, inTime, now, date }: ManualParams) {
  const key = studentKey(day, start, name, period)
  const sched = scheduleStr(day, start)
  const goingOut = action === 'manual-out'
  await set(ref(db, `teachers/${teacherId}/students/${key}`), {
    name, period, schedule: sched,
    status: goingOut ? 'out' : 'in',
    timestamp: serverTimestamp(),
    outTimestamp: goingOut ? serverTimestamp() : null,
  })
  await push(ref(db, `teachers/${teacherId}/logs`), {
    studentName: name, period, schedule: sched, action,
    timestamp: serverTimestamp(), date,
    outTime: goingOut ? now : (outStart ?? now),
    inTime: goingOut ? null : (inTime ?? now),
    duration: goingOut ? null : (inTime ?? now) - (outStart ?? now),
  })
}

interface AutoResetParams {
  teacherId: string
  name: string; period: string; schedule: string
  studentKey: string
  outStart: number; resetTime: number; date: string
}

export async function writeAutoReset({ teacherId, name, period, schedule, studentKey: key, outStart, resetTime, date }: AutoResetParams) {
  // Auto-reset is triggered by a background poll (every second, and on every
  // Firebase snapshot) that can legitimately run more than once for the same
  // student before the first run's write comes back around — either from this
  // same tab (the poll firing again before the previous check finished) or
  // from a second screen (Scanner + Dashboard) open on the same period at
  // once. Guard the actual status flip in a transaction so only whichever
  // check "wins" logs a trip; a redundant check that loses the race sees the
  // student is already 'in' and skips logging entirely — otherwise the same
  // single trip gets written to /logs twice with near-identical durations.
  let didReset = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = await runTransaction(ref(db, `teachers/${teacherId}/students/${key}`), (current: any) => {
    if (!current || current.status !== 'out') { didReset = false; return current }
    didReset = true
    return { ...current, status: 'in', outTimestamp: null, timestamp: resetTime }
  })
  if (!tx.committed || !didReset) return

  await push(ref(db, `teachers/${teacherId}/logs`), {
    studentName: name, period, schedule, action: 'auto-reset',
    timestamp: serverTimestamp(), date,
    outTime: outStart, inTime: resetTime, duration: resetTime - outStart,
  })
}

/**
 * For a student found still marked "out" from a previous calendar day —
 * an orphaned record (e.g. no one reopened that class's screen for the
 * rest of that day, over a weekend, or over a break), not a real in-progress
 * trip. Resets their status immediately and logs it distinctly with
 * duration: null, so it can never be mistaken for a real multi-hour (or
 * multi-month) hall pass and skew trip-time analytics.
 */
export async function writeStaleReset({ teacherId, name, period, schedule, studentKey: key, outStart, resetTime, date }: AutoResetParams) {
  // Same race as writeAutoReset above — guard the flip in a transaction so an
  // overlapping check can't log the same stale-reset twice.
  let didReset = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = await runTransaction(ref(db, `teachers/${teacherId}/students/${key}`), (current: any) => {
    if (!current || current.status !== 'out') { didReset = false; return current }
    didReset = true
    return { ...current, status: 'in', outTimestamp: null, timestamp: resetTime }
  })
  if (!tx.committed || !didReset) return

  await push(ref(db, `teachers/${teacherId}/logs`), {
    studentName: name, period, schedule, action: 'stale-reset',
    timestamp: serverTimestamp(), date,
    outTime: outStart, inTime: resetTime, duration: null,
  })
}
