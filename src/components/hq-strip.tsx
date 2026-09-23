'use client'

// ─── HQ strip ────────────────────────────────────────────────────────────────
// The in-app surface of the basement's Content + Config tabs: maintenance
// banner, active ad campaign and the latest news headline — all managed from
// the hidden superadmin control centre via /api/public/content. Dismissible
// per item (localStorage keeps it closed). Silent no-op when HQ has nothing
// live — the app looks exactly as before.

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface HqData {
  ads: { id: string; title: string; message: string; ctaText: string | null; ctaLink: string | null }[]
  news: { id: string; title: string; category: string }[]
  maintenance: boolean
  maintenanceMessage: string | null
}

const DISMISS_KEY = 'nuvia_hq_strip_dismissed'

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

export default function HqStrip() {
  const [data, setData] = useState<HqData | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissed)

  useEffect(() => {
    let cancelled = false
    fetch('/api/public/content')
      .then((r) => r.json())
      .then((d: HqData) => { if (!cancelled) setData(d) })
      .catch(() => { /* HQ silent — strip stays hidden */ })
    return () => { cancelled = true }
  }, [])

  if (!data) return null

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...next])) } catch { /* private mode */ }
      return next
    })
  }

  const maintenance = data.maintenance && !dismissed.has('maintenance') ? (
    <Strip tone="maintenance" id="maintenance" onDismiss={dismiss}>
      🛠️ {data.maintenanceMessage || 'We are upgrading Nuvia — back shortly.'}
    </Strip>
  ) : null

  const ad = data.ads[0] && !dismissed.has(`ad:${data.ads[0].id}`) ? (
    <Strip tone="ad" id={`ad:${data.ads[0].id}`} onDismiss={dismiss}>
      <span className="font-semibold">{data.ads[0].title}</span>
      <span className="hidden sm:inline"> — {data.ads[0].message}</span>
      {data.ads[0].ctaText && (
        <a href={data.ads[0].ctaLink || '#'} className="ml-2 shrink-0 rounded-full bg-white/25 px-2.5 py-0.5 text-[10px] font-semibold text-white underline-offset-2 hover:underline">
          {data.ads[0].ctaText}
        </a>
      )}
    </Strip>
  ) : null

  const news = data.news[0] && !dismissed.has(`news:${data.news[0].id}`) ? (
    <Strip tone="news" id={`news:${data.news[0].id}`} onDismiss={dismiss}>
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] opacity-80">{data.news[0].category}</span>
      <span className="ml-2 font-semibold">{data.news[0].title}</span>
    </Strip>
  ) : null

  if (!maintenance && !ad && !news) return null

  return (
    <div className="shrink-0 space-y-1 px-2 pt-1.5 sm:px-3" aria-label="Announcements from Nuvia HQ">
      {maintenance}
      {ad}
      {news}
    </div>
  )
}

function Strip({
  tone, id, onDismiss, children,
}: {
  tone: 'maintenance' | 'ad' | 'news'
  id: string
  onDismiss: (id: string) => void
  children: React.ReactNode
}) {
  const tones = {
    maintenance: 'bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-transparent border-amber-500/40 text-amber-100',
    ad: 'bg-gradient-to-r from-fuchsia-600/25 via-rose-500/15 to-transparent border-fuchsia-500/30 text-rose-100',
    news: 'bg-gradient-to-r from-teal-600/20 via-emerald-500/10 to-transparent border-teal-500/30 text-emerald-50',
  } as const
  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug ${tones[tone]}`}>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <button
        onClick={() => onDismiss(id)}
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
