/**
 * Moves everything tied to a student's name in ONE class over to a new name,
 * so renaming in the Roster Editor doesn't split a student in two:
 *
 *   logs/{id}.studentName              — trips for this class (Analytics,
 *                                        today's hall-time total)
 *   students/{day}_{start}_{name}_{P}  — live in/out record (regular + late)
 *   settings/passHolds/{day_n}/{name}  — a paused pass
 *
 * Only this class is touched: the same name in another class (or another
 * day colour) is a separate roster entry and keeps its own history.
 * Everything is written in one multi-path update, so it all moves or nothing does.
 */
import { ref, get, query, orderByChild, equalTo, update } from 'firebase/database'
import { db } from './config'
import { studentKey } from './writes'
import { holdKey } from './holds'
import type { DayKey, PeriodNum } from './roster'
import type { LogEntry, StartType } from '../types'

/** "Red1", "Black3" — the period name the Scanner stores on logs and records. */
export function periodNameFor(day: DayKey, period: PeriodNum): string {
  return `${day === 'red' ? 'Red' : 'Black'}${period}`
}

export async function migrateStudentName(
  teacherId: string, day: DayKey, period: PeriodNum, oldName: string, newName: string
): Promise<{ trips: number }> {
  if (oldName === newName) return { trips: 0 }
  const base = `teachers/${teacherId}`
  const periodName = periodNameFor(day, period)
  const updates: Record<string, unknown> = {}

  // Trips
  const logsSnap = await get(query(ref(db, `${base}/logs`), orderByChild('studentName'), equalTo(oldName)))
  let trips = 0
  const logs = (logsSnap.val() ?? {}) as Record<string, LogEntry>
  for (const [id, log] of Object.entries(logs)) {
    if (log.period !== periodName || !(log.schedule ?? '').startsWith(`${day}_`)) continue
    updates[`logs/${id}/studentName`] = newName
    if (log.action === 'in' || log.action === 'manual-in' || log.action === 'auto-reset') trips++
  }

  // Live status records (one per start type)
  for (const start of ['regular', 'late'] as StartType[]) {
    const oldKey = studentKey(day, start, oldName, periodName)
    const newKey = studentKey(day, start, newName, periodName)
    if (oldKey === newKey) continue
    const snap = await get(ref(db, `${base}/students/${oldKey}`))
    if (!snap.exists()) continue
    updates[`students/${newKey}`] = { ...snap.val(), name: newName }
    updates[`students/${oldKey}`] = null
  }

  // Paused pass
  const rk = `${day}_${period}`
  const oldHold = holdKey(oldName), newHold = holdKey(newName)
  if (oldHold !== newHold) {
    const [snap, existingNew] = await Promise.all([
      get(ref(db, `${base}/settings/passHolds/${rk}/${oldHold}`)),
      get(ref(db, `${base}/settings/passHolds/${rk}/${newHold}`)),
    ])
    if (snap.exists()) {
      // A pause set under the new name (before Save) wins over the old one.
      if (!existingNew.exists()) updates[`settings/passHolds/${rk}/${newHold}`] = { ...snap.val(), name: newName }
      updates[`settings/passHolds/${rk}/${oldHold}`] = null
    }
  }

  if (Object.keys(updates).length) await update(ref(db, base), updates)
  return { trips }
}
