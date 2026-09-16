import { useNavigate } from 'react-router-dom'

const C = {
  bg: '#f8fafc', white: '#fff', ink: '#0f172a', muted: '#94a3b8',
  border: '#e2e8f0', primary: '#667eea',
}

/** Shown by Scanner/Dashboard/Analytics/Editor when :teacherId doesn't match anyone in the directory. */
export default function TeacherNotFound() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'IBM Plex Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ background: C.white, borderRadius: 12, padding: '2rem', border: `1px solid ${C.border}`, textAlign: 'center', maxWidth: 380 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.3rem', color: C.ink, margin: '0 0 8px' }}>Teacher not found</h2>
        <p style={{ fontSize: 13.5, color: C.muted, margin: '0 0 18px' }}>This link doesn't match anyone in the directory.</p>
        <button onClick={() => navigate('/')} style={{ padding: '0.65rem 1.25rem', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
          Back to teacher picker
        </button>
      </div>
    </div>
  )
}
