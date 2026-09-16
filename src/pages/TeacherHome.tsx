import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTeacher } from '../firebase/teachers'
import type { TeacherProfile } from '../firebase/teachers'
import TeacherNotFound from '../components/TeacherNotFound'

const C = {
  bg: '#f8fafc', white: '#fff', ink: '#0f172a', slate: '#475569',
  muted: '#94a3b8', cloud: '#f1f5f9', border: '#e2e8f0',
  green: '#10b981', red: '#ef4444', amber: '#f59e0b',
  primary: '#667eea', purple: '#8b5cf6',
}

const pages = [
  {
    href: 'scanner', label: 'Scanner', desc: 'Students check in and out by name', color: C.primary,
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
  {
    href: 'dashboard', label: 'Dashboard', desc: 'Live view — who is in and out right now', color: C.green,
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },
  {
    href: 'analytics', label: 'Analytics', desc: 'Trip history, trends, and reports', color: C.amber,
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
  {
    href: 'editor', label: 'Roster Editor', desc: 'Set up classes and student lists each semester', color: C.purple,
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  },
]

/**
 * A single teacher's menu — the four nav cards, scoped under /t/:teacherId.
 * This replaces the old single-tenant Home.tsx's nav section; the old
 * fork/Firebase setup guide that used to live here is gone, since onboarding
 * a new classroom is now just "add teacher" on the picker (see
 * TeacherPicker.tsx) rather than standing up a whole new deployment.
 */
export default function TeacherHome() {
  const { teacherId } = useParams<{ teacherId: string }>()
  const [profile, setProfile] = useState<TeacherProfile | null | undefined>(undefined)

  useEffect(() => {
    if (!teacherId) return
    let cancelled = false
    setProfile(undefined)
    getTeacher(teacherId).then(p => { if (!cancelled) setProfile(p) })
    return () => { cancelled = true }
  }, [teacherId])

  if (profile === null) {
    return <TeacherNotFound />
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        {/* ── Header ───────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: '2rem' }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.muted, fontSize: 12.5, fontWeight: 600, textDecoration: 'none', marginBottom: 12 }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            Switch teacher
          </Link>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '2.5rem', color: C.ink, margin: '0 0 6px' }}>
            {profile === undefined ? 'Hall Pass' : profile.displayName}
          </h1>
          <p style={{ color: C.muted, fontSize: '0.95rem', margin: 0 }}>Classroom hall pass tracking</p>
        </div>

        {/* ── Nav cards ────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {pages.map(p => (
            <Link key={p.href} to={`/t/${teacherId}/${p.href}`} style={{ background: C.white, borderRadius: 12, padding: '1rem 1.25rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '1rem', border: `1px solid ${C.border}`, transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: p.color + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.color, flexShrink: 0 }}>{p.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: C.ink, marginBottom: 2 }}>{p.label}</div>
                <div style={{ fontSize: '0.8rem', color: C.muted }}>{p.desc}</div>
              </div>
              <svg width="14" height="14" fill="none" stroke={C.border} viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
