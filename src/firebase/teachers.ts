/**
 * Firebase helpers for teacher profiles — the top-level layer that everything
 * else (roster, students, logs) now lives under.
 *
 * Structure:
 *   directory/
 *     byron-groh/   { displayName: "Byron Groh", createdAt: 1758000000000 }
 *     jane-smith/   { displayName: "Jane Smith", createdAt: 1758003600000 }
 *   config/
 *     pin: "0244"   — legacy universal PIN, kept only as a fallback for
 *                     teachers who haven't set their own PIN yet (see below)
 *   teachers/{teacherId}/settings/
 *     maxOut: 5       — this teacher's default "max students out" for the Scanner
 *     pin: "1234"     — this teacher's own PIN for their Scanner (exiting the
 *                       kiosk, changing the max-out limit)
 *
 * `directory/` is a small, flat index so the teacher picker can list every
 * profile without pulling each teacher's full roster/students/logs subtree —
 * the actual class data lives at teachers/{teacherId}/... (see roster.ts and
 * writes.ts).
 */
import { ref, get, set, update, onValue, serverTimestamp } from 'firebase/database'
import { db } from './config'

export interface TeacherProfile {
  displayName: string
  createdAt: number
}

export type Directory = Record<string, TeacherProfile>

const DEFAULT_PIN = '0244'

/**
 * The teacherId the one-time migration script (scripts/migrate-to-teachers.mjs)
 * creates for the pre-existing flat data (roster/, students/, logs/) — i.e.
 * "your own profile" per the migration decision. Legacy routes (/scanner,
 * /dashboard, /analytics, /editor with no :teacherId) redirect here so old
 * bookmarks and the existing iPad home-screen icons keep working.
 */
export const LEGACY_TEACHER_ID = 'byron-groh'

/** Turns "Jane Smith" into "jane-smith" — used as the teacherId / URL segment. */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function watchDirectory(cb: (data: Directory) => void): () => void {
  const r = ref(db, 'directory')
  return onValue(r, snap => cb((snap.val() as Directory) ?? {}))
}

/** One-time lookup — used to validate a teacherId that came from the URL. */
export async function getTeacher(teacherId: string): Promise<TeacherProfile | null> {
  const snap = await get(ref(db, `directory/${teacherId}`))
  return (snap.val() as TeacherProfile) ?? null
}

/**
 * Creates a new teacher profile. Generates a URL-safe id from the display
 * name, appending -2, -3, ... if that slug is already taken. No PIN or other
 * gate here by design — adding a teacher is something done directly from the
 * picker, not something protected (see Home.tsx).
 */
export async function createTeacher(displayName: string): Promise<string> {
  const trimmed = displayName.trim()
  if (!trimmed) throw new Error('Name is required')

  const base = slugify(trimmed) || 'teacher'
  const dirSnap = await get(ref(db, 'directory'))
  const existing = (dirSnap.val() as Directory) ?? {}

  let id = base
  let n = 2
  while (id in existing) { id = `${base}-${n}`; n++ }

  await set(ref(db, `directory/${id}`), {
    displayName: trimmed,
    createdAt: serverTimestamp(),
  })
  return id
}

export async function renameTeacher(teacherId: string, displayName: string): Promise<void> {
  const trimmed = displayName.trim()
  if (!trimmed) throw new Error('Name is required')
  await update(ref(db, `directory/${teacherId}`), { displayName: trimmed })
}

// ─── Legacy universal PIN ─────────────────────────────────────────────────────
// The original one-PIN-for-everyone value. Kept only as a fallback for a
// teacher who hasn't set their own PIN yet (see getEffectivePin below) — new
// setup should use setTeacherPin instead.

export async function getPin(): Promise<string> {
  const snap = await get(ref(db, 'config/pin'))
  const val = snap.val()
  return typeof val === 'string' && val.length > 0 ? val : DEFAULT_PIN
}

export async function setPin(pin: string): Promise<void> {
  await set(ref(db, 'config/pin'), pin)
}

// ─── Per-teacher settings ─────────────────────────────────────────────────────
// A teacher's own defaults, set from their Settings page (/t/:teacherId/settings)
// and synced via Firebase so they follow the teacher to any device — a fresh
// iPad, a browser refresh, whatever — rather than the app's hardcoded defaults.
// A device's Scanner can still remember its own last-used max-out value in
// localStorage on top of this (see Scanner.tsx); this is just what a brand-new
// device starts from.

export interface TeacherSettings {
  /** Default "max students out at once" for this teacher's Scanner. */
  maxOut: number
  /**
   * This teacher's own PIN. Empty string means "not set yet" — the Scanner
   * should fall back to the legacy shared PIN (getPin/DEFAULT_PIN) in that
   * case, so nothing that worked before this feature existed breaks.
   */
  pin: string
}

const DEFAULT_MAX_OUT = 5

function normalizeSettings(raw: unknown): TeacherSettings {
  const val = (raw as Partial<TeacherSettings>) ?? {}
  return {
    maxOut: typeof val.maxOut === 'number' && val.maxOut > 0 ? val.maxOut : DEFAULT_MAX_OUT,
    pin: typeof val.pin === 'string' ? val.pin : '',
  }
}

export async function getTeacherSettings(teacherId: string): Promise<TeacherSettings> {
  const snap = await get(ref(db, `teachers/${teacherId}/settings`))
  return normalizeSettings(snap.val())
}

/**
 * `onError` fires if the read is denied (most likely cause: the Firebase
 * rules haven't been updated to include the new `settings` node yet — see
 * firebase.rules.json). Without it, a denied read just never calls `cb` and
 * the caller is stuck showing a loading state forever with no explanation.
 */
export function watchTeacherSettings(
  teacherId: string,
  cb: (s: TeacherSettings) => void,
  onError?: (err: Error) => void
): () => void {
  const r = ref(db, `teachers/${teacherId}/settings`)
  return onValue(
    r,
    snap => cb(normalizeSettings(snap.val())),
    err => onError?.(err as unknown as Error)
  )
}

export async function setTeacherMaxOut(teacherId: string, maxOut: number): Promise<void> {
  await update(ref(db, `teachers/${teacherId}/settings`), { maxOut })
}

export async function setTeacherPin(teacherId: string, pin: string): Promise<void> {
  await update(ref(db, `teachers/${teacherId}/settings`), { pin })
}

/**
 * The PIN a teacher's Scanner should actually use: their own custom PIN if
 * they've set one, otherwise the legacy shared building-wide PIN — so a
 * teacher who never opens Settings keeps working exactly as before.
 */
export async function getEffectivePin(teacherId: string): Promise<string> {
  const settings = await getTeacherSettings(teacherId)
  if (settings.pin) return settings.pin
  return getPin()
}
