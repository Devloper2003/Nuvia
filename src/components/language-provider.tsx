'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import {
  LANG_STORAGE_KEY,
  translate,
  type Lang,
  type TranslationKey,
} from '@/lib/i18n/translations'

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Translate a key, interpolating {vars}. Falls back to English. */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'hi' || value === 'ta'
}

// ─── localStorage as an external store (hydration + lint safe) ──────────────
// useSyncExternalStore renders 'en' on the server and during the first client
// render, then swaps to the stored preference — no setState-in-effect, no
// hydration mismatch. Bonus: the `storage` event gives free cross-tab sync.

const listeners = new Set<() => void>()

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  window.addEventListener('storage', callback)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', callback)
  }
}

function getSnapshot(): Lang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY)
    return isLang(stored) ? stored : 'en'
  } catch {
    return 'en'
  }
}

function getServerSnapshot(): Lang {
  return 'en'
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setLang = useCallback((next: Lang) => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next)
    } catch {
      // best-effort persistence (private mode)
    }
    document.documentElement.lang = next
    // Notify local subscribers (storage event only fires in OTHER tabs).
    listeners.forEach((notify) => notify())
  }, [])

  // Keep <html lang> in sync with the active language (DOM write, no state).
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    // Safe fallback so components can render outside the provider (e.g. the
    // offline page) without crashing — English is always available.
    return {
      lang: 'en',
      setLang: () => {},
      t: (key, vars) => translate('en', key, vars),
    }
  }
  return ctx
}
