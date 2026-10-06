/**
 * Firebase helpers for "paused" hall passes — a teacher-set hold that stops a
 * specific student from checking OUT on the Scanner until a given date.
 *
 * Structure:
 *   teachers/{teacherId}/settings/passHolds/
 *     red_1/
 *       Liam/     { name: "Liam",   until: 1760248800000, setAt: 1759680000000 }
 *       Flynn_B/  { name: "Flynn B", setAt: 1759680000000 }      ← no `until` = no end date
 *     black_2/
 *       ...
 *
 * Why this is NOT stored inside roster/{red_1}:
 *   Every roster save path overwrites the whole period node — savePeriod()
 *   uses set(), and the PowerSchool upload's "Update & Sync" / "Replace
 *   Entirely" both write complete period objects (see roster.ts). A flag
 *   stored on the roster would be silently wiped the next time a roster is
 *   re-uploaded. Keeping holds in their own node means a pause survives any
 *   roster edit.
 *
 * Why it lives under settings/:
 *   firebase.rules.json only opens students, logs, roster and settings under
 *   each teacher. Nesting under settings/ means this feature needs no rules
 *   change/deploy. Everything that writes settings uses update() on single
 *   fields (setTeacherMaxOut, setTeacherPin), so nothing clobbers this node,
 *   and normalizeSettings() ignores keys it doesn't know.
 *
 * Holds are keyed by the same `${day}_${periodNum}` key the roster uses, so
 * a pause applies to that class on both regular and late-start days.
 *
 * `until` is the moment the pass comes BACK — local midnight at the start of
 * the return date. A hold is active while now < until. Compare against
 * serverNow() (see clock.ts), not the device clock.
 */
import { ref, set, remove, onValue } from 'firebase/database'
import { db } from './config'

export interface PassHold {
  /** The student's roster name exactly as it appears in roster/{key}/students. */
  name: string
  /** Epoch ms when the pass returns, or null for "until I remove it". */
  until: number | null
  /** Epoch ms when the pause was set (device time — informational only). */
  setAt: number
}

/** Holds for one period, keyed by holdKey(name). */
export type PeriodHolds = Record<string, PassHold>
/** All of a teacher's holds, keyed by roster key ("red_1", "black_3", ...). */
export type HoldsData = Record<string, PeriodHolds>

/** Firebase-safe key for a student name — same escaping as studentKey() in writes.ts. */
export function holdKey(name: string): string {
  return name.replace(/[.#$[\]/]/g, '_')
}

function holdsPath(teacherId: string): string {
  return `teachers/${teacherId}/settings/passHolds`
}

/** Firebase drops null fields, so a missing `until` reads back as "no end date". */
function normalizeHolds(raw: unknown): HoldsData {
  const out: HoldsData = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [rosterKey, period] of Object.entries(raw as Record<string, unknown>)) {
    if (!period || typeof period !== 'object') continue
    const holds: PeriodHolds = {}
    for (const [key, val] of Object.entries(period as Record<string, unknown>)) {
      const v = val as Partial<PassHold> | null
      if (!v || typeof v.name !== 'string') continue
      holds[key] = {
        name: v.name,
        until: typeof v.until === 'number' ? v.until : null,
        setAt: typeof v.setAt === 'number' ? v.setAt : 0,
      }
    }
    if (Object.keys(holds).length > 0) out[rosterKey] = holds
  }
  return out
}

export function watchHolds(
  teacherId: string,
  cb: (data: HoldsData) => void,
  onError?: (err: Error) => void
): () => void {
  return onValue(
    ref(db, holdsPath(teacherId)),
    snap => cb(normalizeHolds(snap.val())),
    err => onError?.(err as unknown as Error)
  )
}

/** Pauses (or re-dates) one student's pass. `until: null` = no end date. */
export async function setHold(teacherId: string, rosterKey: string, name: string, until: number | null): Promise<void> {
  const data: Record<string, unknown> = { name, setAt: Date.now() }
  if (until !== null) data.until = until
  await set(ref(db, `${holdsPath(teacherId)}/${rosterKey}/${holdKey(name)}`), data)
}

/** Resumes one student's pass. */
export async function clearHold(teacherId: string, rosterKey: string, name: string): Promise<void> {
  await remove(ref(db, `${holdsPath(teacherId)}/${rosterKey}/${holdKey(name)}`))
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function isHoldActive(hold: PassHold | null | undefined, now: number): boolean {
  if (!hold) return false
  return hold.until === null || now < hold.until
}

/** The student's hold for this period if it's still in effect, otherwise null. */
export function getActiveHold(holds: HoldsData, rosterKey: string | null, name: string, now: number): PassHold | null {
  if (!rosterKey) return null
  const hold = holds[rosterKey]?.[holdKey(name)]
  return hold && isHoldActive(hold, now) ? hold : null
}

/** Every hold still in effect for one period, sorted by name. */
export function activeHoldsFor(holds: HoldsData, rosterKey: string, now: number): PassHold[] {
  return Object.values(holds[rosterKey] ?? {})
    .filter(h => isHoldActive(h, now))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
// A return date is always a whole calendar day in the device's local time zone:
// "paused until Oct 12" means the pass works again from the start of Oct 12.

function pad(n: number): string { return String(n).padStart(2, '0') }

/** "2026-10-12" for a <input type="date">, `daysFromToday` days out, local time. */
export function dateInputFromToday(daysFromToday: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + daysFromToday)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Epoch ms → "2026-10-12" (local). */
export function dateInputFromMs(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "2026-10-12" → epoch ms at LOCAL midnight (new Date("2026-10-12") would be UTC). */
export function msFromDateInput(value: string): number | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0).getTime()
}

/** "Monday, October 12" — for the student-facing Scanner popup. */
export function holdLongLabel(until: number): string {
  return new Date(until).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

/** "Mon, Oct 12" — for teacher-facing chips and badges. */
export function holdShortLabel(until: number | null): string {
  if (until === null) return 'no end date'
  return new Date(until).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
