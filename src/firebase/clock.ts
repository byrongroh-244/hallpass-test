/**
 * Server-synced clock.
 *
 * outTimestamp / timestamp are written with serverTimestamp() (Firebase's
 * clock), but elapsed-time math used to subtract them from Date.now() (the
 * device's clock). On any device whose clock drifts, timers started at a
 * non-zero value (or negative), and logged durations were skewed.
 *
 * Firebase publishes this device's offset from server time at
 * .info/serverTimeOffset — use serverNow() anywhere a "now" is compared
 * against a stored timestamp.
 */
import { ref, onValue } from 'firebase/database'
import { db } from './config'

let offsetMs = 0

onValue(ref(db, '.info/serverTimeOffset'), snap => {
  const v = snap.val()
  offsetMs = typeof v === 'number' ? v : 0
})

export function serverNow(): number {
  return Date.now() + offsetMs
}
