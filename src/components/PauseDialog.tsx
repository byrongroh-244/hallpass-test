/**
 * Shared "pause hall pass" UI.
 *
 *   PauseDialog      — one student (Roster Editor)
 *   BulkPauseDialog  — a checklist of students (Analytics "Needs attention")
 *
 * Both use the same "Pass returns" picker, so the date options and the
 * layout only live in one place. The date a teacher picks is the day the pass
 * comes BACK — see firebase/holds.ts.
 */
import { useState } from 'react'
import { dateInputFromToday, dateInputFromMs, msFromDateInput, holdLongLabel, holdShortLabel } from '../firebase/holds'
import type { PassHold } from '../firebase/holds'
import { useWindowSize } from '../hooks/useWindowSize'

const C = {
  white: '#fff', ink: '#0f172a', slate: '#475569', muted: '#94a3b8',
  cloud: '#f1f5f9', border: '#e2e8f0',
  green: '#10b981',
  amber: '#f59e0b', amberBg: 'rgba(245,158,11,0.08)', amberInk: '#b45309',
}

// One spacing scale for the whole dialog, so every gap is deliberate:
// label → its control = 8, between controls in a group = 8, between groups = 20.
const GAP = { tight: 8, group: 20 }
const CONTROL_H = 40

export function PauseIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

const PAUSE_PRESETS: { label: string; days: number }[] = [
  { label: 'Tomorrow', days: 1 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
]

// ─── Return-date state + fields ───────────────────────────────────────────────

interface ReturnDate {
  openEnded: boolean
  date: string
  minDate: string
  /** Epoch ms the pass returns, or null for "no end date" (or an invalid date — check `valid`). */
  until: number | null
  valid: boolean
  pickDate: (value: string) => void
  pickOpenEnded: () => void
}

function useReturnDate(existing: PassHold | null): ReturnDate {
  const [openEnded, setOpenEnded] = useState(existing ? existing.until === null : false)
  const [date, setDate] = useState(() =>
    existing && existing.until !== null ? dateInputFromMs(existing.until) : dateInputFromToday(7))
  const minDate = dateInputFromToday(1)
  const until = openEnded ? null : msFromDateInput(date)
  return {
    openEnded, date, minDate, until,
    valid: openEnded || (until !== null && date >= minDate),
    pickDate: value => { setOpenEnded(false); setDate(value) },
    pickOpenEnded: () => setOpenEnded(true),
  }
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
  letterSpacing: '0.6px', marginBottom: GAP.tight,
}

function ReturnDateFields({ rd, narrow }: { rd: ReturnDate; narrow: boolean }) {
  // Every option is the same size whether or not it's selected: the border is
  // always 1px and the selected state adds an inset ring instead of a thicker
  // border, so picking one never nudges its neighbours.
  const option = (selected: boolean): React.CSSProperties => ({
    height: CONTROL_H, padding: '0 4px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
    whiteSpace: 'nowrap', textAlign: 'center',
    border: `1px solid ${selected ? C.amber : C.border}`,
    boxShadow: selected ? `inset 0 0 0 1px ${C.amber}` : 'none',
    background: selected ? C.amberBg : C.white,
    color: selected ? C.amberInk : C.slate, fontWeight: selected ? 700 : 500,
  })

  return (
    <div>
      <div style={labelStyle}>Pass returns</div>
      {/* Four equal columns (2×2 on a phone) — never a ragged wrap */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${narrow ? 2 : 4}, minmax(0, 1fr))`, gap: GAP.tight }}>
        {PAUSE_PRESETS.map(p => {
          const value = dateInputFromToday(p.days)
          return (
            <button key={p.label} type="button" onClick={() => rd.pickDate(value)} style={option(!rd.openEnded && rd.date === value)}>
              {p.label}
            </button>
          )
        })}
        <button type="button" onClick={rd.pickOpenEnded} style={option(rd.openEnded)}>No end date</button>
      </div>
      {/* Stays in place (dimmed) for "No end date" so the dialog doesn't jump
          in height; picking a date here switches back to a dated pause.
          appearance/minHeight keep iOS Safari from shrinking or centring it. */}
      <input type="date" value={rd.date} min={rd.minDate} aria-label="Pass returns on"
        onChange={e => rd.pickDate(e.target.value)}
        style={{
          display: 'block', width: '100%', height: CONTROL_H, minHeight: CONTROL_H, marginTop: GAP.tight,
          padding: '0 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.white,
          fontSize: 14, color: C.ink, fontFamily: 'inherit', outline: 'none', textAlign: 'left',
          WebkitAppearance: 'none', appearance: 'none',
          opacity: rd.openEnded ? 0.4 : 1,
        }} />
    </div>
  )
}

// ─── Dialog frame ─────────────────────────────────────────────────────────────

function Frame({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div role="dialog" aria-modal="true" aria-label={`${eyebrow}: ${title}`}
        style={{ background: C.white, borderRadius: 16, padding: 24, width: 420, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: GAP.group }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.amberInk, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>{eyebrow}</div>
          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.4rem', lineHeight: 1.2, color: C.ink, margin: 0 }}>{title}</h3>
        </div>
        {children}
      </div>
    </div>
  )
}

function Summary({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: C.slate, lineHeight: 1.5, margin: 0 }}>{children}</p>
}

// Footer buttons. Cancel carries `marginLeft: auto`, which right-aligns Cancel +
// the primary button and leaves "Resume now" (when present) on the left.
function footerButtons(narrow: boolean) {
  const base: React.CSSProperties = {
    height: CONTROL_H, padding: narrow ? '0 12px' : '0 16px', borderRadius: 8,
    fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
  }
  return {
    resume: { ...base, border: `1px solid ${C.border}`, background: C.white, color: C.green } as React.CSSProperties,
    cancel: { ...base, marginLeft: 'auto', border: `1px solid ${C.border}`, background: C.cloud, color: C.slate } as React.CSSProperties,
    primary: (enabled: boolean): React.CSSProperties => ({
      ...base, padding: narrow ? '0 16px' : '0 20px', border: 'none', background: C.ink, color: '#fff',
      fontWeight: 700, cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.5,
    }),
  }
}

// ─── Single student ───────────────────────────────────────────────────────────

export default function PauseDialog({ name, existing, onCancel, onConfirm, onResume }: {
  name: string
  existing: PassHold | null
  onCancel: () => void
  onConfirm: (until: number | null) => Promise<void>
  onResume: () => Promise<void>
}) {
  const rd = useReturnDate(existing)
  const narrow = useWindowSize().width < 460
  const btn = footerButtons(narrow)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  return (
    <Frame eyebrow={existing ? 'Hall pass paused' : 'Pause hall pass'} title={name}>
      <ReturnDateFields rd={rd} narrow={narrow} />

      <Summary>
        {!rd.valid
          ? 'Pick a return date after today.'
          : rd.until === null
            ? `${name} can't check out on the scanner until you resume the pass.`
            : `${name} can't check out on the scanner until ${holdLongLabel(rd.until)}.`}
      </Summary>

      <div style={{ display: 'flex', gap: GAP.tight }}>
        {existing && <button type="button" onClick={() => run(onResume)} disabled={busy} style={btn.resume}>Resume now</button>}
        <button type="button" onClick={onCancel} disabled={busy} style={btn.cancel}>Cancel</button>
        <button type="button" onClick={() => run(() => onConfirm(rd.until))} disabled={busy || !rd.valid} style={btn.primary(!busy && rd.valid)}>
          {existing ? 'Update' : 'Pause'}
        </button>
      </div>
    </Frame>
  )
}

// ─── Several students at once ─────────────────────────────────────────────────

export interface BulkPauseStudent {
  name: string
  /** Why they're on the list, e.g. "3 trips over 10 min". */
  detail: string
  /** Their pause if one is already in effect. */
  hold: PassHold | null
  /** False if the name isn't on the class's current roster (left the class, or renamed). */
  onRoster: boolean
}

export function BulkPauseDialog({ title, students, onCancel, onConfirm }: {
  title: string
  students: BulkPauseStudent[]
  onCancel: () => void
  onConfirm: (names: string[], until: number | null) => Promise<void>
}) {
  const rd = useReturnDate(null)
  const narrow = useWindowSize().width < 460
  const btn = footerButtons(narrow)
  const [busy, setBusy] = useState(false)
  // Start with everyone ticked who can be paused and isn't already — an
  // already-paused student can still be ticked to move their return date.
  const [picked, setPicked] = useState<Set<string>>(() =>
    new Set(students.filter(s => s.onRoster && !s.hold).map(s => s.name)))

  const toggle = (name: string) => setPicked(prev => {
    const next = new Set(prev)
    if (next.has(name)) next.delete(name); else next.add(name)
    return next
  })

  const names = students.filter(s => picked.has(s.name)).map(s => s.name)
  const count = names.length
  const who = count === 1 ? names[0] : `${count} students`
  const canPause = !busy && rd.valid && count > 0

  const confirm = async () => {
    setBusy(true)
    try { await onConfirm(names, rd.until) } finally { setBusy(false) }
  }

  return (
    <Frame eyebrow="Pause hall passes" title={title}>
      <div>
        <div style={labelStyle}>Students</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 232, overflowY: 'auto' }}>
          {students.map(s => {
            const checked = picked.has(s.name)
            return (
              <label key={s.name} style={{
                display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '6px 12px', borderRadius: 8, flexShrink: 0,
                border: `1px solid ${checked ? C.amber : C.border}`, background: checked ? C.amberBg : C.white,
                cursor: s.onRoster ? 'pointer' : 'default', opacity: s.onRoster ? 1 : 0.55,
              }}>
                <input type="checkbox" checked={checked} disabled={!s.onRoster} onChange={() => toggle(s.name)}
                  style={{ width: 16, height: 16, flexShrink: 0, accentColor: C.amber, cursor: 'inherit' }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span style={{ display: 'block', fontSize: 11, color: C.slate }}>{s.detail}</span>
                </span>
                {!s.onRoster
                  ? <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>Not on roster</span>
                  : s.hold && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.amberInk, whiteSpace: 'nowrap' }}>
                      {s.hold.until === null ? 'Paused · no end date' : `Paused until ${holdShortLabel(s.hold.until)}`}
                    </span>
                  )}
              </label>
            )
          })}
        </div>
      </div>

      <ReturnDateFields rd={rd} narrow={narrow} />

      <Summary>
        {count === 0
          ? 'Tick at least one student.'
          : !rd.valid
            ? 'Pick a return date after today.'
            : rd.until === null
              ? `${who} can't check out on the scanner until you resume the pass.`
              : `${who} can't check out on the scanner until ${holdLongLabel(rd.until)}.`}
      </Summary>

      <div style={{ display: 'flex', gap: GAP.tight }}>
        <button type="button" onClick={onCancel} disabled={busy} style={btn.cancel}>Cancel</button>
        <button type="button" onClick={confirm} disabled={!canPause} style={btn.primary(canPause)}>
          {count > 1 ? `Pause ${count}` : 'Pause'}
        </button>
      </div>
    </Frame>
  )
}
