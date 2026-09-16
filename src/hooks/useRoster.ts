import { useEffect, useState } from 'react'
import { watchRoster } from '../firebase/roster'
import type { RosterData } from '../firebase/roster'

/**
 * Real-time listener for a teacher's roster/ node in Firebase.
 * Returns the full roster data, updating instantly when the editor makes changes.
 */
export function useRoster(teacherId: string): { roster: RosterData; loading: boolean } {
  const [roster, setRoster] = useState<RosterData>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const unsubscribe = watchRoster(teacherId, data => {
      setRoster(data)
      setLoading(false)
    })
    return unsubscribe
  }, [teacherId])

  return { roster, loading }
}
