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
import { ref, push, serverTimestamp, runTransaction } from 'firebase/database'
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

  // Guard the status flip in a transaction — a duplicate tap (e.g. a
  // pointermove firing commitSwipe twice) or a second device/tab open to the
  // same class both calling this for the same student now race on the same
  // node instead of both blindly writing. If the student is already marked
  // 'out' by the time this runs, treat it as a no-op: don't stomp the
  // original out-time and don't log a second "out" for the same trip.
  let didWrite = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = await runTransaction(ref(db, `teachers/${teacherId}/students/${key}`), (current: any) => {
    if (current && current.status === 'out') { didWrite = false; return current }
    didWrite = true
    return { name, period, schedule: sched, status: 'out', timestamp: outTime, outTimestamp: outTime }
  })
  if (!tx.committed || !didWrite) return

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

  // Same guard as writeStudentOut, mirrored: only flip 'out' -> 'in' once.
  // A redundant call (duplicate tap, second device) that arrives after the
  // student is already 'in' sees that and skips logging — otherwise the
  // same single trip gets written to /logs twice with near-identical
  // durations, which is exactly what shows up as "double-logged trips".
  let didWrite = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = await runTransaction(ref(db, `teachers/${teacherId}/students/${key}`), (current: any) => {
    if (!current || current.status !== 'out') { didWrite = false; return current }
    didWrite = true
    return { name, period, schedule: sched, status: 'in', timestamp: inTime, outTimestamp: null }
  })
  if (!tx.committed || !didWrite) return

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

  // Same guard as writeStudentOut/In — protects against a duplicate click on
  // the Dashboard's manual override button, or the Dashboard being open on
  // two devices/tabs at once.
  let didWrite = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = await runTransaction(ref(db, `teachers/${teacherId}/students/${key}`), (current: any) => {
    const targetStatus = goingOut ? 'out' : 'in'
    if (current && current.status === targetStatus) { didWrite = false; return current }
    didWrite = true
    return {
      name, period, schedule: sched,
      status: targetStatus,
      timestamp: now,
      outTimestamp: goingOut ? now : null,
    }
  })
  if (!tx.committed || !didWrite) return

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
