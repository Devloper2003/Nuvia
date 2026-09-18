'use client'

import { RotateCcw } from 'lucide-react'

// Client island for the offline page's "Try again" action — the page itself
// stays a Server Component (so it renders from pure cached HTML offline).
export function RetryButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-rose-500/25 transition-all hover:shadow-lg hover:shadow-rose-500/30 hover:-translate-y-0.5 active:translate-y-0"
    >
      <RotateCcw className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-180" />
      Try again
    </button>
  )
}
