// ─── Legacy brand-key migration (ChandraCycle → Nuvia) ──────────────────────
// The app was originally branded "ChandraCycle", so older browser sessions
// still hold localStorage/sessionStorage keys prefixed with `chandracycle_`
// (auth token, sidebar pref, language, tour-seen flags, admin token…).
// This one-time, idempotent sweep copies every legacy key to its `nuvia_`
// equivalent (without clobbering a newer value) and removes the old key.
// Safe to call multiple times — it's a no-op once no legacy keys remain.

export function migrateLegacyBrandKeys(): void {
  if (typeof window === 'undefined') return
  const LEGACY_PREFIX = 'chandracycle_'
  const NEW_PREFIX = 'nuvia_'
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      // Iterate backwards: key(i) indexes shift as we remove items.
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i)
        if (!key || !key.startsWith(LEGACY_PREFIX)) continue
        const newKey = NEW_PREFIX + key.slice(LEGACY_PREFIX.length)
        const value = storage.getItem(key)
        if (value !== null && storage.getItem(newKey) === null) {
          storage.setItem(newKey, value)
        }
        storage.removeItem(key)
      }
    } catch {
      // Storage unavailable (private mode / blocked) — nothing to migrate.
    }
  }
}
