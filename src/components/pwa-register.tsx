'use client'

import { useEffect, useState } from 'react'

// Minimal typing for the (still non-standard) install prompt event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Registers the Nuvia service worker (offline shell caching) and
 * captures the browser's `beforeinstallprompt` event so an "Install app"
 * action can be offered anywhere via the `nuvia-install` window event.
 *
 * Renders nothing — this component is purely behavioural.
 */
export function PwaRegister() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // ─── Service worker registration ────────────────────────────────────────
    if ('serviceWorker' in navigator) {
      const register = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .catch(() => {
            // SW is a progressive enhancement — never block the app on it.
          })
      }
      if (document.readyState === 'complete') {
        register()
      } else {
        window.addEventListener('load', register, { once: true })
      }
    }

    // ─── Install prompt capture ─────────────────────────────────────────────
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', () => setInstallEvent(null))

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }, [])

  // Expose the deferred prompt to the rest of the app (sidebar install button)
  // through a custom event, and listen for install requests back.
  useEffect(() => {
    if (!installEvent) return
    const onRequest = () => {
      void installEvent.prompt()
      void installEvent.userChoice.then(({ outcome }) => {
        if (outcome === 'accepted') {
          window.dispatchEvent(new CustomEvent('nuvia-installed'))
        }
        setInstallEvent(null)
      })
    }
    window.addEventListener('nuvia-install-request', onRequest)
    return () => {
      window.removeEventListener('nuvia-install-request', onRequest)
    }
  }, [installEvent])

  // Signal installability so the UI can show/hide the install entry point.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('nuvia-installable', { detail: { available: !!installEvent } })
    )
  }, [installEvent])

  return null
}
