/**
 * Firebase helpers for teacher profiles — the top-level layer that everything
 * else (roster, students, logs) now lives under.
 *
 * Structure:
 *   directory/
 *     byron-groh/   { displayName: "Byron Groh", createdAt: 1758000000000 }
 *     jane-smith/   { displayName: "Jane Smith", createdAt: 1758003600000 }
 *   config/
 *     pin: "0244"   — the one universal PIN, shared by every teacher's scanner
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

// ─── Universal PIN ────────────────────────────────────────────────────────────
// One PIN, shared by every teacher's Scanner (leaving the kiosk, changing the
// day/period/max-out settings). Lives in Firebase — rather than a build-time
// env var — so it can be changed without a redeploy.

export async function getPin(): Promise<string> {
  const snap = await get(ref(db, 'config/pin'))
  const val = snap.val()
  return typeof val === 'string' && val.length > 0 ? val : DEFAULT_PIN
}

export async function setPin(pin: string): Promise<void> {
  await set(ref(db, 'config/pin'), pin)
}
