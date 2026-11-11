import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import TeacherPicker from './pages/TeacherPicker'
import TeacherHome from './pages/TeacherHome'
import Scanner from './pages/Scanner'
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'
import Editor from './pages/Editor'
import TeacherSettings from './pages/TeacherSettings'
import { LEGACY_TEACHER_ID } from './firebase/teachers'
import { getKioskLock } from './utils/kioskLock'

/**
 * While this device has a locked Scanner (see utils/kioskLock.ts), any other
 * page — reached by the iPad back/forward swipe, a bookmark, or a typed URL —
 * is replaced by that Scanner before it renders. Nothing else mounts, so no
 * teacher page ever flashes up for a student.
 */
function KioskGuard({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const lock = getKioskLock()
  if (lock && pathname !== lock) return <Navigate to={lock} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter basename="/hallpass-test">
      <KioskGuard>
      <Routes>
        {/* Teacher picker — the new home page */}
        <Route path="/" element={<TeacherPicker />} />

        {/* Per-teacher pages */}
        <Route path="/t/:teacherId"           element={<TeacherHome />} />
        <Route path="/t/:teacherId/scanner"   element={<Scanner />} />
        <Route path="/t/:teacherId/dashboard" element={<Dashboard />} />
        <Route path="/t/:teacherId/analytics" element={<Analytics />} />
        <Route path="/t/:teacherId/editor"    element={<Editor />} />
        <Route path="/t/:teacherId/settings"  element={<TeacherSettings />} />

        {/* Legacy routes (pre-multi-teacher bookmarks / iPad home-screen icons) —
            redirect to the migrated "legacy" teacher profile so nothing that
            was already set up on a classroom device breaks. */}
        <Route path="/scanner"   element={<Navigate to={`/t/${LEGACY_TEACHER_ID}/scanner`} replace />} />
        <Route path="/dashboard" element={<Navigate to={`/t/${LEGACY_TEACHER_ID}/dashboard`} replace />} />
        <Route path="/analytics" element={<Navigate to={`/t/${LEGACY_TEACHER_ID}/analytics`} replace />} />
        <Route path="/editor"    element={<Navigate to={`/t/${LEGACY_TEACHER_ID}/editor`} replace />} />

        {/* Anything else falls back to the picker */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </KioskGuard>
    </BrowserRouter>
  )
}
