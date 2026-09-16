import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { watchDirectory, createTeacher } from '../firebase/teachers'
import type { Directory } from '../firebase/teachers'

const C = {
  bg: '#f8fafc', white: '#fff', ink: '#0f172a', slate: '#475569',
  muted: '#94a3b8', cloud: '#f1f5f9', border: '#e2e8f0',
  green: '#10b981', red: '#ef4444', amber: '#f59e0b',
  primary: '#667eea', purple: '#8b5cf6',
}

/**
 * The new "/" — a picker listing every teacher profile in the building's
 * shared Firebase project. Selecting one goes to that teacher's own menu
 * (/t/:teacherId); "+ Add teacher" creates a new profile on the spot, no PIN
 * — see teachers.ts for why. This replaces the old single-tenant Home.tsx,
 * including its fork/Firebase setup guide, which no longer applies now that
 * every classroom shares one deployment.
 */
export default function TeacherPicker() {
  const navigate = useNavigate()
  const [directory, setDirectory] = useState<Directory>({})
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = watchDirectory(data => {
      setDirectory(data)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const entries = Object.entries(directory).sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      const id = await createTeacher(name)
      navigate(`/t/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create profile')
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '2.5rem', color: C.ink, margin: '0 0 6px' }}>Hall Pass</h1>
          <p style={{ color: C.muted, fontSize: '0.95rem', margin: 0 }}>Choose your profile to continue</p>
        </div>

        {loading ? (
          <div style={{ color: C.muted, fontSize: 14, padding: '1rem 0' }}>Loading teachers…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
            {entries.length === 0 && (
              <div style={{ background: C.white, borderRadius: 12, padding: '1.25rem', border: `1px solid ${C.border}`, color: C.muted, fontSize: 13.5, textAlign: 'center' }}>
                No teacher profiles yet — add the first one below.
              </div>
            )}
            {entries.map(([id, profile]) => (
              <button
                key={id}
                onClick={() => navigate(`/t/${id}`)}
                style={{ background: C.white, borderRadius: 12, padding: '1rem 1.25rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '1rem', border: `1px solid ${C.border}`, cursor: 'pointer', font: 'inherit' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div style={{ width: 42, height: 42, borderRadius: 10, background: C.primary + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.primary, flexShrink: 0, fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 18 }}>
                  {profile.displayName.trim().charAt(0).toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: C.ink }}>{profile.displayName}</div>
                </div>
                <svg width="14" height="14" fill="none" stroke={C.border} viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            ))}
          </div>
        )}

        {/* ── Add teacher ──────────────────────────────────────────────────────── */}
        {adding ? (
          <form onSubmit={handleAdd} style={{ background: C.white, borderRadius: 12, padding: '1.1rem 1.25rem', border: `1px solid ${C.border}` }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              New teacher's name
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Jane Smith"
              style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 0.8rem', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, marginBottom: 10, fontFamily: 'inherit' }}
            />
            {error && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={saving || !name.trim()}
                style={{ flex: 1, padding: '0.65rem', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: saving ? 'default' : 'pointer', opacity: saving || !name.trim() ? 0.6 : 1 }}>
                {saving ? 'Creating…' : 'Create profile'}
              </button>
              <button type="button" onClick={() => { setAdding(false); setName(''); setError('') }}
                style={{ padding: '0.65rem 1rem', borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.slate, fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            style={{ width: '100%', padding: '0.9rem', borderRadius: 12, border: `1.5px dashed ${C.border}`, background: 'none', color: C.slate, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add teacher
          </button>
        )}
      </div>
    </div>
  )
}
