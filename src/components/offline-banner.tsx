'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, Wifi } from 'lucide-react'

/**
 * Global connectivity banner — listens to browser online/offline events and
 * shows a slim amber ribbon at the very top of the viewport while offline,
 * with a brief green "back online" confirmation when the connection returns.
 *
 * Mounted once in AppShell so it covers desktop and mobile layouts.
 * Renders nothing while online.
 */
export function OfflineBanner() {
  // Lazy initialiser: read the real connectivity once (SSR-safe fallback true)
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [backOnline, setBackOnline] = useState(false)

  useEffect(() => {
    const goOffline = () => setOnline(false)
    const goOnline = () => {
      setOnline(true)
      setBackOnline(true)
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
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
