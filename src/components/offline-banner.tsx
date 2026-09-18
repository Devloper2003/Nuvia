'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, Wifi } from 'lucide-react'

// Canonical React pattern for external mutable state (navigator.onLine):
// the server snapshot is `true` so SSR renders nothing, and the client
// snapshot is read during hydration — no hydration mismatch, no setState
// inside an effect body. (Node 21+ exposes a global `navigator` whose
// `onLine` is undefined, so reading it during SSR render is a trap.)
function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

/**
 * Global connectivity banner — listens to browser online/offline events and
 * shows a slim amber ribbon at the very top of the viewport while offline,
 * with a brief green "back online" confirmation when the connection returns.
 *
 * Mounted once in AppShell so it covers desktop and mobile layouts.
 * Renders nothing while online.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true // server snapshot — always "online" during SSR
  )
  const [backOnline, setBackOnline] = useState(false)
  const prevOnline = useRef(true)

  // Detect offline → online transitions from event handlers only.
  useEffect(() => {
    const handle = () => {
      const now = navigator.onLine
      const was = prevOnline.current
      prevOnline.current = now
      if (!was && now) setBackOnline(true)
    }
    window.addEventListener('online', handle)
    window.addEventListener('offline', handle)
    return () => {
      window.removeEventListener('online', handle)
      window.removeEventListener('offline', handle)
    }
  }, [])

  // Auto-dismiss the "back online" confirmation after 3s
  useEffect(() => {
    if (!backOnline) return
    const t = setTimeout(() => setBackOnline(false), 3000)
    return () => clearTimeout(t)
  }, [backOnline])

  return (
    <AnimatePresence>
      {online ? (
        backOnline && (
          <motion.div
            key="online"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-emerald-500/95 text-white text-xs font-medium px-4 py-1.5 shadow-lg backdrop-blur"
            role="status"
            aria-live="polite"
          >
            <Wifi className="h-3.5 w-3.5" />
            Back online — syncing your latest data
          </motion.div>
        )
      ) : (
        <motion.div
          key="offline"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-medium px-4 py-1.5 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          <WifiOff className="h-3.5 w-3.5" />
          You&apos;re offline — data shown may be out of date. Changes will sync when you reconnect.
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default OfflineBanner
