import { Moon, WifiOff, Home } from 'lucide-react'
import { RetryButton } from './retry-button'

// ─── /offline — PWA fallback for navigations that fail while offline ─────────
// Precached by the service worker (public/sw.js CORE list). When a navigation
// request fails (no network) and the target route isn't in cache, the SW
// serves this page instead of the browser's dead "no internet" screen.
// Everything renders from the cached HTML — no data fetches on this page.

export const metadata = {
  title: 'You are offline — Nuvia',
}

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-rose-50 via-white to-orange-50 dark:from-rose-950/30 dark:via-background dark:to-orange-950/20 px-6 py-12 text-center">
      <div className="relative mb-6" aria-hidden="true">
        <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-2xl" />
        <div className="relative h-20 w-20 rounded-3xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-500/25 rotate-[-6deg]">
          <Moon className="h-10 w-10 text-white" fill="currentColor" />
        </div>
        <div className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-white dark:bg-background shadow-md flex items-center justify-center">
          <WifiOff className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
        </div>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        You&rsquo;re offline
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Nuvia needs a connection to load this page. Your logged data is
        safe and will sync as soon as you&rsquo;re back online.
      </p>

      <div className="mt-7 flex flex-col sm:flex-row items-center gap-3">
        <RetryButton />
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-full border px-6 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
        >
          <Home className="h-4 w-4" />
          Go to homepage
        </a>
      </div>

      <p className="mt-10 text-xs text-muted-foreground/70 flex items-center gap-1.5">
        <Moon className="h-3 w-3" aria-hidden="true" />
        Nuvia works offline for pages you&rsquo;ve visited before.
      </p>
    </div>
  )
}
