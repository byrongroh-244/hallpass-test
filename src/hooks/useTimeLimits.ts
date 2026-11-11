import { useEffect, useState } from 'react'
import { watchTimeLimits } from '../firebase/timeLimits'
import type { TimeLimitsData } from '../firebase/timeLimits'

/** Real-time listener for per-class hall time limits (settings/timeLimits). */
export function useTimeLimits(teacherId: string): TimeLimitsData {
  const [limits, setLimits] = useState<TimeLimitsData>({})
  useEffect(() => {
    setLimits({})
    if (!teacherId) return
    return watchTimeLimits(
      teacherId,
      setLimits,
      err => console.error('watchTimeLimits failed — are the Firebase rules for settings/ deployed?', err)
    )
  }, [teacherId])
  return limits
}
