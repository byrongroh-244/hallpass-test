import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTeacherGuard } from '../hooks/useTeacherGuard'
import TeacherNotFound from '../components/TeacherNotFound'
import { watchTeacherSettings, setTeacherMaxOut, setTeacherPin } from '../firebase/teachers'
import type { TeacherSettings as Settings } from '../firebase/teachers'

const C = {
  bg: '#f8fafc', white: '#fff', ink: '#0f172a', slate: '#475569',
  muted: '#94a3b8', cloud: '#f1f5f9', border: '#e2e8f0',
  green: '#10b981', greenBg: 'rgba(16,185,129,0.1)',
  red: '#ef4444', redBg: 'rgba(239,68,68,0.08)', amber: '#f59e0b',
  primary: '#667eea', purple: '#8b5cf6',
}

const MAX_OUT_OPTIONS = [2, 3, 4, 5, 6, 7, 8]

/**
 * A teacher's own default settings — reached from their menu
 * (/t/:teacherId/settings). These sync via Firebase (teachers/{id}/settings)
 * so they follow the teacher to any device, unlike the Scanner's per-device
 * "last used" values in localStorage (see lsKeyFor in Scanner.tsx).
 */
export default function TeacherSettings() {
  const { teacherId: teacherIdParam } = useParams<{ teacherId: string }>()
  const teacherId = teacherIdParam ?? ''
  const teacherValid = useTeacherGuard(teacherId)

  const [settings, setSettings] = useState<Settings | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [maxOut, setMaxOutLocal] = useState<number>(5)
  const [maxOutSaved, setMaxOutSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [pinDigits, setPinDigits] = useState(['', '', '', ''])
  const [pinSaved, setPinSaved] = useState(false)
  const [pinError, setPinError] = useState('')

  useEffect(() => {
    if (!teacherId) return
    const unsubscribe = watchTeacherSettings(
      teacherId,
      s => { setSettings(s); setMaxOutLocal(s.maxOut); setLoadError(null) },
      err => setLoadError(err.message || 'Permission denied')
    )
    return unsubscribe
  }, [teacherId])

  if (teacherValid === false) return <TeacherNotFound />

  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'IBM Plex Sans', sans-serif" }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
          <Link to={`/t/${teacherId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.muted, fontSize: 12.5, fontWeight: 600, textDecoration: 'none', marginBottom: 20 }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            Back to menu
          </Link>
          <div style={{ background: C.white, borderRadius: 12, padding: '1.5rem', border: `1px solid ${C.border}` }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.3rem', color: C.ink, margin: '0 0 10px' }}>Couldn't load settings</h2>
            <p style={{ fontSize: 13.5, color: C.slate, lineHeight: 1.6, margin: '0 0 12px' }}>
              This is almost always a Firebase rules issue — the <code>settings</code> node under each
              teacher needs its own read/write rule, the same way <code>roster</code>, <code>students</code>,
              and <code>logs</code> already do.
            </p>
            <p style={{ fontSize: 13.5, color: C.slate, lineHeight: 1.6, margin: '0 0 12px' }}>
              In the Firebase console → Realtime Database → Rules, make sure each teacher's rules include:
            </p>
            <pre style={{ background: C.cloud, borderRadius: 8, padding: '10px 12px', fontSize: 12.5, overflowX: 'auto', margin: '0 0 12px' }}>
{`"settings": {
  ".read": true,
  ".write": true
}`}
            </pre>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Error detail: {loadError}</p>
          </div>
        </div>
      </div>
    )
  }

  const hasCustomPin = !!settings?.pin
  const maxOutDirty = settings !== null && maxOut !== settings.maxOut

  async function saveMaxOut() {
    setSaveError('')
    try {
      await setTeacherMaxOut(teacherId, maxOut)
      setMaxOutSaved(true)
      setTimeout(() => setMaxOutSaved(false), 2000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save — check Firebase rules')
    }
  }

  async function savePin() {
    const pin = pinDigits.join('')
    if (pin.length !== 4) {
      setPinError('Enter all 4 digits')
      return
    }
    try {
      await setTeacherPin(teacherId, pin)
      setPinDigits(['', '', '', ''])
      setPinError('')
      setPinSaved(true)
      setTimeout(() => setPinSaved(false), 2000)
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Could not save — check Firebase rules')
    }
  }

  async function clearPin() {
    try {
      await setTeacherPin(teacherId, '')
      setPinDigits(['', '', '', ''])
      setPinError('')
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Could not save — check Firebase rules')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        {/* ── Header ───────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: '2rem' }}>
          <Link to={`/t/${teacherId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.muted, fontSize: 12.5, fontWeight: 600, textDecoration: 'none', marginBottom: 12 }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            Back to menu
          </Link>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '2.2rem', color: C.ink, margin: '0 0 6px' }}>Settings</h1>
          <p style={{ color: C.muted, fontSize: '0.95rem', margin: 0 }}>Your defaults — these follow you to any device</p>
        </div>

        {settings === null ? (
          <div style={{ color: C.muted, fontSize: 14, padding: '1rem 0' }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* ── Max students out ──────────────────────────────────────────────── */}
            <div style={{ background: C.white, borderRadius: 12, padding: '1.25rem', border: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: C.ink, marginBottom: 2 }}>Max students out at once</div>
              <p style={{ fontSize: 13, color: C.muted, margin: '0 0 14px' }}>
                The default cap your Scanner starts with on a new device. A device that's already been set up keeps whatever it was last changed to there — this is just the starting point.
              </p>
              <select
                value={maxOut}
                onChange={e => setMaxOutLocal(parseInt(e.target.value))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 15, color: C.ink, fontFamily: 'inherit', background: C.white, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
              >
                {MAX_OUT_OPTIONS.map(n => (
                  <option key={n} value={n}>{n} students</option>
                ))}
              </select>
              <button onClick={saveMaxOut} disabled={!maxOutDirty}
                style={{ width: '100%', marginTop: 10, padding: '10px 0', borderRadius: 8, border: 'none', background: maxOutDirty ? C.primary : C.cloud, color: maxOutDirty ? '#fff' : C.muted, fontSize: 14, fontWeight: 700, cursor: maxOutDirty ? 'pointer' : 'default' }}>
                {maxOutSaved ? 'Saved ✓' : maxOutDirty ? 'Save default' : 'No change'}
              </button>
              {saveError && <p style={{ color: C.red, fontSize: 12.5, marginTop: 8, marginBottom: 0 }}>{saveError}</p>}
            </div>

            {/* ── Custom PIN ───────────────────────────────────────────────────── */}
            <div style={{ background: C.white, borderRadius: 12, padding: '1.25rem', border: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: C.ink, marginBottom: 2 }}>Your PIN</div>
              <p style={{ fontSize: 13, color: C.muted, margin: '0 0 14px' }}>
                Used on your Scanner to leave the kiosk or change the student limit.{' '}
                {hasCustomPin
                  ? "You've set your own PIN — other teachers' PINs won't work on your Scanner."
                  : "You haven't set one yet, so your Scanner still uses the shared building PIN."}
              </p>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 12 }}>
                {pinDigits.map((d, i) => (
                  <input key={i} id={`settings-pin-${i}`} type="password" inputMode="numeric" maxLength={1} value={d}
                    onChange={e => {
                      const val = e.target.value.slice(-1).replace(/[^0-9]/g, '')
                      const next = [...pinDigits]; next[i] = val; setPinDigits(next); setPinError('')
                      if (val && i < 3) document.getElementById(`settings-pin-${i + 1}`)?.focus()
                    }}
                    onKeyDown={e => { if (e.key === 'Backspace' && !pinDigits[i] && i > 0) document.getElementById(`settings-pin-${i - 1}`)?.focus() }}
                    style={{ width: 48, height: 56, fontSize: '1.4rem', textAlign: 'center', border: `2px solid ${pinError ? C.red : C.border}`, borderRadius: 10, fontFamily: 'monospace', outline: 'none', color: C.ink, background: pinError ? C.redBg : C.white }}
                  />
                ))}
              </div>
              {pinError && <p style={{ color: C.red, fontSize: 13, textAlign: 'center', margin: '0 0 12px' }}>{pinError}</p>}

              <button onClick={savePin} disabled={pinDigits.join('').length !== 4}
                style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: pinDigits.join('').length === 4 ? C.primary : C.cloud, color: pinDigits.join('').length === 4 ? '#fff' : C.muted, fontSize: 14, fontWeight: 700, cursor: pinDigits.join('').length === 4 ? 'pointer' : 'default', marginBottom: hasCustomPin ? 8 : 0 }}>
                {pinSaved ? 'Saved ✓' : 'Set PIN'}
              </button>
              {hasCustomPin && (
                <button onClick={clearPin}
                  style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.slate, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Clear my PIN (use the shared building PIN instead)
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
