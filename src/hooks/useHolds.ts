import { useEffect, useState } from 'react'
import { watchHolds } from '../firebase/holds'
import type { HoldsData } from '../firebase/holds'

/**
 * Real-time listener for a teacher's paused hall passes
 * (teachers/{teacherId}/settings/passHolds). Updates instantly when a pause
 * is set or lifted in the roster editor, so the Scanner never needs a refresh.
 */
export function useHolds(teacherId: string): HoldsData {
  const [holds, setHolds] = useState<HoldsData>({})

  useEffect(() => {
    setHolds({})
    if (!teacherId) return
    return watchHolds(
      teacherId,
      setHolds,
      err => console.error('watchHolds failed — are the Firebase rules for settings/ deployed?', err)
    )
  }, [teacherId])

  return holds
}
