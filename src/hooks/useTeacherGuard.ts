import { useEffect, useState } from 'react'
import { getTeacher } from '../firebase/teachers'

/**
 * Validates a :teacherId route param against the Firebase directory.
 * Returns undefined while checking, true if it exists, false if it doesn't
 * (a stale bookmark, a typo, or a deleted profile) — pages use this to show
 * a "Teacher not found" state instead of silently reading/writing to a path
 * that doesn't correspond to any real profile.
 */
export function useTeacherGuard(teacherId: string | undefined): boolean | undefined {
  const [valid, setValid] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    if (!teacherId) { setValid(false); return }
    let cancelled = false
    setValid(undefined)
    getTeacher(teacherId).then(t => { if (!cancelled) setValid(!!t) })
    return () => { cancelled = true }
  }, [teacherId])
  return valid
}
