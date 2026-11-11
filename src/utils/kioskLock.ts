/**
 * Scanner kiosk lock.
 *
 * On a classroom iPad running Hall Pass as a Home Screen web app under Guided
 * Access, the edge swipe is Safari's "back" gesture — Guided Access doesn't
 * block it — so students could swipe from the Scanner back to Teacher Home
 * without the PIN.
 *
 * When a Scanner opens, it records its own path here (per device, in
 * localStorage, so it survives closing the app or rebooting). While a lock is
 * set, <KioskGuard> in App.tsx redirects every other route back to that
 * Scanner. The only way out is the PIN on the Scanner's Home button, which
 * clears the lock.
 */
const KEY = 'hp_kiosk_lock'

/** Router path (no basename) of the locked Scanner, e.g. "/t/smith/scanner". */
export function getKioskLock(): string | null {
  try { return localStorage.getItem(KEY) } catch { return null }
}

export function setKioskLock(path: string): void {
  try { localStorage.setItem(KEY, path) } catch { /* storage unavailable — no lock */ }
}

export function clearKioskLock(): void {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
