/**
 * Firebase helpers for the roster node.
 * Structure (namespaced per teacher — see teachers.ts):
 *   teachers/
 *     {teacherId}/
 *       roster/
 *         red_1/ { name: "Algebra I", students: ["Liam", "Flynn", ...] }
 *         red_2/ { name: "Algebra I", students: [...] }
 *         black_2/ { name: "Geometry", students: [...] }
 *         ...
 */
import { ref, get, set, update, onValue } from 'firebase/database'
import { db } from './config'

export type DayKey = 'red' | 'black'
export type PeriodNum = 1 | 2 | 3 | 4

export interface RosterPeriod {
  name: string
  students: string[]
}

export type RosterData = Partial<Record<string, RosterPeriod>>

export function rosterKey(day: DayKey, period: PeriodNum): string {
  return `${day}_${period}`
}

export async function getRoster(teacherId: string): Promise<RosterData> {
  const snap = await get(ref(db, `teachers/${teacherId}/roster`))
  return (snap.val() as RosterData) ?? {}
}

export function watchRoster(teacherId: string, cb: (data: RosterData) => void): () => void {
  const r = ref(db, `teachers/${teacherId}/roster`)
  return onValue(r, snap => cb((snap.val() as RosterData) ?? {}))
}

export async function savePeriod(teacherId: string, day: DayKey, period: PeriodNum, data: RosterPeriod): Promise<void> {
  await set(ref(db, `teachers/${teacherId}/roster/${rosterKey(day, period)}`), data)
}

/**
 * Writes a batch of periods parsed from an upload (e.g. the Full Year Upload
 * flow, which may only contain one or a few classes if that's all the file
 * had). Uses `update()` rather than `set()` so it merges into the existing
 * roster — only the period keys present in `data` are written — instead of
 * replacing the whole `roster` node and wiping out every other period that
 * wasn't in this particular file.
 */
export async function saveFullRoster(teacherId: string, data: RosterData): Promise<void> {
  if (Object.keys(data).length === 0) return
  await update(ref(db, `teachers/${teacherId}/roster`), data)
}

/**
 * The deliberate, explicit version of the old destructive behavior: replaces
 * the ENTIRE roster node with only what's in `data`. Any period not present
 * in `data` is permanently deleted. Only call this after the user has been
 * shown exactly which existing periods that would wipe out and has
 * confirmed they want that — this is the "Replace Entirely" choice, as
 * opposed to the default "Update & Sync" (saveFullRoster) which merges.
 */
export async function replaceFullRoster(teacherId: string, data: RosterData): Promise<void> {
  await set(ref(db, `teachers/${teacherId}/roster`), data)
}

// ─── Name parsing helpers ─────────────────────────────────────────────────────

interface NameEntry { first: string; lastInitial: string }

/**
 * Deduplicates a list of entries — if two share a first name,
 * appends last initial to both.
 */
export function deduplicateNames(entries: NameEntry[]): string[] {
  const counts: Record<string, number> = {}
  entries.forEach(e => { counts[e.first] = (counts[e.first] ?? 0) + 1 })
  return entries.map(e => counts[e.first] > 1 ? `${e.first} ${e.lastInitial}` : e.first)
}

/**
 * Parses a PowerSchool CSV export (single class).
 * Name column format: "Last, First Middle..."
 */
export function parseRosterCSV(csvText: string): string[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return []
  const header = parseCSVLine(lines[0])
  const nameIdx = header.findIndex(h => h.toLowerCase() === 'name')
  if (nameIdx === -1) return []
  const entries: NameEntry[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    const raw = cols[nameIdx] ?? ''
    if (!raw) continue
    const commaIdx = raw.indexOf(',')
    if (commaIdx === -1) continue
    const lastName = raw.slice(0, commaIdx).trim()
    const first = raw.slice(commaIdx + 1).trim().split(' ')[0].trim()
    if (!first) continue
    entries.push({ first, lastInitial: lastName[0]?.toUpperCase() ?? '' })
  }
  return deduplicateNames(entries)
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''; let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue }
    current += ch
  }
  result.push(current.trim())
  return result
}

/**
 * Parses a PowerSchool Excel export (all classes in one file).
 * Reads the file as text (TSV extracted by the browser's FileReader).
 * Course column format: "1(Red) Algebra I" or "2(Blk) Geometry"
 * Returns a full RosterData object ready to save to Firebase.
 */
export interface ExcelParseResult {
  roster: RosterData
  warnings: string[]
  summary: { key: string; name: string; count: number }[]
}

export function parseExcelTSV(tsvText: string): ExcelParseResult {
  const lines = tsvText.split('\n').map(l => l.trim()).filter(Boolean)
  const warnings: string[] = []
  if (lines.length < 2) return { roster: {}, warnings: ['No data found in file'], summary: [] }

  // Find header row — look for Name and Course columns
  const headerLine = lines[0].split('\t').map(h => h.trim().toLowerCase())
  const nameIdx = headerLine.findIndex(h => h === 'name')
  const courseIdx = headerLine.findIndex(h => h === 'course')

  if (nameIdx === -1 || courseIdx === -1) {
    return { roster: {}, warnings: ['Could not find Name and Course columns'], summary: [] }
  }

  // Group entries by period
  const periodEntries: Record<string, { name: string; entries: NameEntry[] }> = {}

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(c => c.trim())
    const nameRaw = cols[nameIdx] ?? ''
    const courseRaw = cols[courseIdx] ?? ''
    if (!nameRaw || !courseRaw) continue

    // Parse name: "Last, First" or "Last Name, First Middle"
    const commaIdx = nameRaw.indexOf(',')
    if (commaIdx === -1) continue
    const lastName = nameRaw.slice(0, commaIdx).trim()
    const first = nameRaw.slice(commaIdx + 1).trim().split(' ')[0].trim()
    if (!first) continue
    const lastInitial = lastName[0]?.toUpperCase() ?? '?'

    // Parse course: "1(Red) Algebra I" or "2(Blk) Geometry"
    const m = courseRaw.match(/^(\d+)\((Red|Blk)\)\s*(.+)$/)
    if (!m) {
      warnings.push(`Skipped unrecognized course format: "${courseRaw}"`)
      continue
    }
    const periodNum = parseInt(m[1])
    const day: DayKey = m[2] === 'Red' ? 'red' : 'black'
    const className = m[3].trim()
    const key = `${day}_${periodNum}`

    if (!periodEntries[key]) periodEntries[key] = { name: className, entries: [] }
    periodEntries[key].entries.push({ first, lastInitial })
  }

  // Build roster with deduplication
  const roster: RosterData = {}
  const summary: ExcelParseResult['summary'] = []

  for (const [key, data] of Object.entries(periodEntries)) {
    const students = deduplicateNames(data.entries).sort()
    roster[key] = { name: data.name, students }
    summary.push({ key, name: data.name, count: students.length })

    // Warn about duplicates
    const dupes = data.entries.filter((e, i, arr) =>
      arr.findIndex(x => x.first === e.first) !== i
    )
    if (dupes.length > 0) {
      const names = [...new Set(dupes.map(d => d.first))]
      warnings.push(`${key}: Duplicate first names found — last initials added for: ${names.join(', ')}`)
    }
  }

  return { roster, warnings, summary }
}
