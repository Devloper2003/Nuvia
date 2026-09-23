'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useCallback, useSyncExternalStore } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import AuthScreen, { type SessionUser } from '@/components/auth/auth-screen'
import { BrandMark, BrandTagline } from '@/components/brand/brand-logo'
import { useAppStore } from '@/lib/store'

// AppShell (sidebar + 20 modules) only loads AFTER authentication + onboarding.
// This keeps the initial page bundle tiny and prevents memory exhaustion
// during the first compile.
const AppShell = dynamic(() => import('@/components/app-shell'), {
  loading: () => <AppLoader />,
})

// Onboarding is also lazy-loaded so it doesn't bloat the auth-screen bundle.
const OnboardingLazy = dynamic(() => import('@/components/modules/onboarding'), {
  loading: () => <AppLoader />,
})

// Hydration-safe hook using useSyncExternalStore (recommended by React 19)
const emptySubscribe = () => () => {}
function useMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

// Static, hydration-safe loading screen. Rendered identically on server
// and client (no time/random/locale dependencies) so React never complains
// about a hydration mismatch. Brand animations are pure CSS → same DOM.
function AppLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-5">
      <BrandMark size="lg" />
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading Nuvia…</span>
        </div>
        <BrandTagline className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground/80" dotClassName="h-[3px] w-[3px]" />
      </div>
    </div>
  )
}

export default function Home() {
  const mounted = useMounted()
  const [authUser, setAuthUser] = useState<SessionUser | null>(null)
  const [authChecking, setAuthChecking] = useState(true)
  const setActiveModule = useAppStore((s) => s.setActiveModule)

  // Check existing session on mount
  useEffect(() => {
    let cancelled = false
    async function checkSession() {
      // ─── Google OAuth redirect bridge ───────────────────────────────────────
      // The authorize/callback flow returns to /?auth=google (success, session
      // cookie set) or /?auth_error=<code>. Clean the URL and act on it.
      const params = new URLSearchParams(window.location.search)
      const authError = params.get('auth_error')
      const authOk = params.get('auth') === 'google'
      if (authError || authOk) {
        window.history.replaceState({}, '', window.location.pathname)
        if (authError) {
          const messages: Record<string, string> = {
            google_not_configured: 'Google Sign-In is not configured yet — set it up in Settings.',
            google_denied: 'Google sign-in was cancelled.',
            google_state_mismatch: 'Sign-in session expired — please try again.',
            google_missing_code: 'Google sign-in did not complete — please try again.',
            google_redirect_mismatch: 'The redirect URI is not whitelisted in your Google Cloud client.',
            google_invalid_client: 'That Google Client ID is not valid — check the credentials.',
            google_callback_failed: 'Google sign-in failed — please try again.',
          }
          toast.error(messages[authError] || 'Google sign-in failed — please try again.')
          // Configuration problems are fixable in-app: ask the auth screen to
          // open the setup dialog (which shows the exact origin + redirect URI
          // to whitelist in the Google Cloud Console). A sessionStorage flag
          // survives the AuthScreen mount race — the listener may not exist
          // yet when checkSession runs.
          if (authError === 'google_redirect_mismatch' || authError === 'google_invalid_client') {
            try {
              sessionStorage.setItem('nuvia:open-google-setup', '1')
            } catch { /* private mode */ }
          }
        }
        if (authOk) {
          // The session lives in an httpOnly cookie; /me echoes the token so we
          // can persist it for Bearer requests too.
          try {
            const me = await fetch('/api/auth/me', { credentials: 'include' })
            const meData = await me.json()
            if (meData?.user) {
              if (meData.token) localStorage.setItem('nuvia_token', meData.token)
              if (!cancelled) {
                setAuthUser(meData.user)
                setAuthChecking(false)
              }
              toast.success(`Signed in as ${meData.user.email}`)
              return
            }
          } catch {
            /* fall through to normal session check */
          }
        }
      }

      const token = typeof window !== 'undefined' ? localStorage.getItem('nuvia_token') : null
      if (!token) {
        if (!cancelled) setAuthChecking(false)
        return
      }
      try {
        // Self-heal legacy oversized tokens (>8KB chars → 431 risk): swap them
        // for a slim token via the refresh route (token travels in the BODY).
        let activeToken = token
        if (token.length > 8000) {
          try {
            const refreshRes = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token }),
            })
            if (refreshRes.ok) {
              const refreshData = await refreshRes.json()
              if (refreshData.token) {
                activeToken = refreshData.token
                localStorage.setItem('nuvia_token', activeToken)
              }
            }
          } catch {
            /* keep the old token — /me will decide */
          }
        }
        const res = await fetch('/api/auth/me', {
          headers: { authorization: `Bearer ${activeToken}` },
        })
        const data = await res.json()
        if (!cancelled) {
          if (data.user) {
            setAuthUser(data.user)
          } else {
            localStorage.removeItem('nuvia_token')
          }
          setAuthChecking(false)
        }
      } catch {
        if (!cancelled) setAuthChecking(false)
      }
    }
    checkSession()
    return () => { cancelled = true }
  }, [])

  const handleAuthed = useCallback((user: SessionUser) => {
    setAuthUser(user)
  }, [])

  // Profile updates (avatar upload, settings save) broadcast the fresh user —
  // keep the auth state (the source of truth AppShell receives) in sync
  // without a reload.
  useEffect(() => {
    const onAuthUserUpdated = (e: Event) => {
      const user = (e as CustomEvent<SessionUser>).detail
      if (user && typeof user.id === 'string' && user.id) setAuthUser(user)
    }
    window.addEventListener('nuvia:auth-user', onAuthUserUpdated)
    return () => window.removeEventListener('nuvia:auth-user', onAuthUserUpdated)
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    localStorage.removeItem('nuvia_token')
    setAuthUser(null)
    setActiveModule('dashboard')
    toast.success('Signed out successfully')
  }, [setActiveModule])

  // Called when onboarding finishes — re-fetch the user so the profile
  // (lastPeriodStart, onboardingComplete) is fresh, then show the app.
  const handleOnboardingComplete = useCallback(async () => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('nuvia_token')
      : null
    try {
      const res = await fetch('/api/auth/me', {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      if (data.user) {
        setAuthUser(data.user)
      } else {
        // Fallback: just flip the flag locally so the user isn't stuck.
        setAuthUser((prev) => prev ? { ...prev, onboardingComplete: true } : prev)
      }
    } catch {
      setAuthUser((prev) => prev ? { ...prev, onboardingComplete: true } : prev)
    }
    toast.success('Welcome to Nuvia! 🌸')
  }, [])

  // Loading screen (prevents hydration mismatch).
  // NOTE: We render the EXACT same JSX on server and client during the
  // loading state so hydration matches byte-for-byte. The brand mark and
  // the text "Loading Nuvia…" are static literals — no
  // Date.now(), no Math.random(), no locale-dependent formatting.
  if (!mounted || authChecking) {
    return <AppLoader />
  }

  // Auth gate
  if (!authUser) {
    return <AuthScreen onAuthed={handleAuthed} />
  }

  // Onboarding gate — show the simplified 3-step onboarding for users who
  // haven't completed it yet (new signups, mobile OTP users, etc.).
  if (!authUser.onboardingComplete) {
    return <OnboardingLazy onComplete={handleOnboardingComplete} />
  }

  // Authenticated app (lazy-loaded)
  return <AppShell user={authUser} onLogout={handleLogout} />
}
