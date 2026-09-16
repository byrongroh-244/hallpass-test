#!/usr/bin/env node
/**
 * One-time migration: copies the pre-multi-teacher flat Firebase data
 * (roster/, students/, logs/) into the new teachers/{teacherId}/... subtree,
 * creates a directory/{teacherId} entry for it, and seeds config/pin with
 * whatever admin PIN you were using before.
 *
 * This is COPY-ONLY — it never deletes or modifies the old flat roster/,
 * students/, or logs/ nodes. If anything looks wrong afterward, the
 * original data is still sitting there untouched and nothing was lost.
 *
 * Usage:
 *   node scripts/migrate-to-teachers.mjs
 *   node scripts/migrate-to-teachers.mjs --id byron-groh --name "Byron Groh"
 *   node scripts/migrate-to-teachers.mjs --force   # re-run even if already migrated
 *
 * Needs your Firebase connection info — reads it from a `.env` file in the
 * repo root (same VITE_FIREBASE_* keys used by the app) if one exists, or
 * from already-exported environment variables.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get, set, update, goOffline } from 'firebase/database'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

// ─── Tiny .env loader (no extra dependency) ────────────────────────────────

function loadDotEnv(path) {
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}

loadDotEnv(join(repoRoot, '.env'))

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function argVal(flag, fallback) {
  const i = args.indexOf(flag)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}
const force = args.includes('--force')
const teacherId = argVal('--id', 'byron-groh')
const displayName = argVal('--name', 'Byron Groh')

// ─── Firebase setup ─────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

if (!firebaseConfig.databaseURL || !firebaseConfig.projectId) {
  console.error(
    '\nMissing Firebase connection info.\n' +
    'Put your VITE_FIREBASE_* values in a .env file at the repo root (see .env.example),\n' +
    'or export them as environment variables before running this script.\n'
  )
  process.exit(1)
}

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

// ─── Migration ──────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nMigrating flat data → teachers/${teacherId}/ ...\n`)

  const existing = (await get(ref(db, `directory/${teacherId}`))).val()
  if (existing && !force) {
    console.log(`directory/${teacherId} already exists ("${existing.displayName}") — nothing to do.`)
    console.log('Pass --force to re-copy anyway (this will NOT delete anything, only overwrite the destination).\n')
    return
  }

  const [rosterSnap, studentsSnap, logsSnap] = await Promise.all([
    get(ref(db, 'roster')),
    get(ref(db, 'students')),
    get(ref(db, 'logs')),
  ])
  const roster = rosterSnap.val() ?? {}
  const students = studentsSnap.val() ?? {}
  const logs = logsSnap.val() ?? {}

  const rosterCount = Object.keys(roster).length
  const studentsCount = Object.keys(students).length
  const logsCount = Object.keys(logs).length
  console.log(`Found: ${rosterCount} roster period(s), ${studentsCount} student record(s), ${logsCount} log entrie(s)`)

  // Copy — set() on the NEW destination path only. The old flat roster/,
  // students/, logs/ nodes are only ever read here, never written to.
  await Promise.all([
    rosterCount > 0 ? set(ref(db, `teachers/${teacherId}/roster`), roster) : Promise.resolve(),
    studentsCount > 0 ? set(ref(db, `teachers/${teacherId}/students`), students) : Promise.resolve(),
    logsCount > 0 ? set(ref(db, `teachers/${teacherId}/logs`), logs) : Promise.resolve(),
  ])
  console.log(`Copied into teachers/${teacherId}/`)

  // Directory entry
  await set(ref(db, `directory/${teacherId}`), {
    displayName,
    createdAt: Date.now(),
  })
  console.log(`Created directory/${teacherId} ("${displayName}")`)

  // Seed the universal PIN — only if config/pin isn't already set, so a
  // re-run never clobbers a PIN someone already changed from the app.
  const pinSnap = await get(ref(db, 'config/pin'))
  if (pinSnap.val() == null) {
    const legacyPin = process.env.VITE_ADMIN_PIN || process.env.VITE_SCANNER_PIN || '0244'
    await set(ref(db, 'config/pin'), legacyPin)
    console.log(`Seeded config/pin from your old env var (or the default)`)
  } else {
    console.log(`config/pin already set — left it alone`)
  }

  console.log(
    `\nDone. Your existing app will keep working at the /scanner, /dashboard, /analytics,\n` +
    `/editor URLs — those now redirect to /t/${teacherId}/... automatically.\n` +
    `The old flat roster/, students/, logs/ nodes were left in place, untouched.\n`
  )
}

main()
  .catch(err => { console.error('\nMigration failed:', err); process.exitCode = 1 })
  .finally(() => { goOffline(db); process.exit(process.exitCode ?? 0) })
