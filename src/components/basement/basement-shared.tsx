'use client'

// ─── Basement shared kit ─────────────────────────────────────────────────────
// Types, fetch wrapper and dark ops-theme atoms used across the secret
// superadmin control centre. This module never imports app-store state —
// the basement is fully self-contained by design.

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface BasementOperator {
  name: string
  email: string
  role: string
}

export const ADMIN_TOKEN_KEY = 'nuvia_admin_token'

// Shape of the authenticated fetcher handed to every HQ module.
export type AdminFetch = <T>(url: string, init?: RequestInit) => Promise<T>

// Fetch wrapper: attaches the operator bearer, normalizes errors, and fires
// onExpired() when the server says the session is gone (401).
export function makeAdminFetch(token: string, onExpired: () => void) {
  return async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
        authorization: `Bearer ${token}`,
      },
    })
    if (res.status === 401 || res.status === 403) {
      onExpired()
      throw new Error('Session expired')
    }
    const data = await res.json().catch(() => null)
    if (data === null) {
      // A 200 with an unparseable body (e.g. dropped pooler stream) must not
      // silently become {} and poison component state with undefined.
      throw new Error('Malformed response from server — try again')
    }
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
    return data as T
  }
}

// ── formatting helpers ──
export const fmtNum = (n: number) => n.toLocaleString('en-IN')
export const fmtDate = (iso: string | Date | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export const fmtDateTime = (iso: string | Date | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
export const fmtRelative = (iso: string | Date | null | undefined) => {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(iso)
}

// ── dark theme constants (deep plum-black ops aesthetic) ──
export const panelCls = 'rounded-xl border border-white/10 bg-white/[0.035] backdrop-blur-sm'
export const inputDarkCls =
  'bg-white/[0.05] border-white/15 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-400/40 focus-visible:border-amber-400/40'

// ── atoms ──
export function KpiCard({
  label, value, sub, tone = 'default', icon,
}: {
  label: string
  value: string | number
  sub?: string
  tone?: 'default' | 'gold' | 'rose' | 'emerald' | 'danger'
  icon?: ReactNode
}) {
  const tones: Record<string, string> = {
    default: 'text-zinc-100',
    gold: 'text-amber-300',
    rose: 'text-rose-300',
    emerald: 'text-emerald-300',
    danger: 'text-red-400',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(panelCls, 'p-3.5 hover:border-white/20 transition-colors')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">{label}</span>
        {icon && <span className="text-zinc-500">{icon}</span>}
      </div>
      <div className={cn('mt-1.5 font-mono text-2xl font-semibold tabular-nums', tones[tone])}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-zinc-500">{sub}</div>}
    </motion.div>
  )
}

export function DarkBadge({ children, tone = 'zinc' }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    zinc: 'bg-white/[0.06] text-zinc-300 border-white/10',
    gold: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
    rose: 'bg-rose-400/10 text-rose-300 border-rose-400/30',
    emerald: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
    danger: 'bg-red-500/10 text-red-400 border-red-500/30',
    violet: 'bg-violet-400/10 text-violet-300 border-violet-400/30',
    sky: 'bg-sky-400/10 text-sky-300 border-sky-400/30',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider', tones[tone] ?? tones.zinc)}>
      {children}
    </span>
  )
}

// Small dark section heading used by every HQ tab.
export function SectionTitle({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
      {icon}
      {children}
    </p>
  )
}

// Two-step confirm button: first click arms it (rose), second click fires,
// auto-disarms after 2.5s. Keeps destructive HQ ops one-component simple.
export function ConfirmButton({
  onConfirm, children, confirmLabel = 'Confirm?', disabled, className, tone = 'rose',
}: {
  onConfirm: () => void | Promise<void>
  children: ReactNode
  confirmLabel?: string
  disabled?: boolean
  className?: string
  tone?: 'rose' | 'gold' | 'zinc'
}) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const click = async () => {
    if (!armed) {
      setArmed(true)
      timer.current = setTimeout(() => setArmed(false), 2500)
      return
    }
    if (timer.current) clearTimeout(timer.current)
    setArmed(false)
    await onConfirm()
  }

  const tones: Record<string, string> = {
    rose: 'border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20',
    gold: 'border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20',
    zinc: 'border-white/15 bg-white/[0.04] text-zinc-300 hover:bg-white/10',
  }
  const armedCls = tone === 'gold'
    ? 'border-amber-300 bg-amber-300 text-[#0a0810] hover:bg-amber-200'
    : 'border-red-400 bg-red-500/80 text-white hover:bg-red-500'

  return (
    <Button variant="outline" size="sm" onClick={() => void click()} disabled={disabled}
      className={cn('h-7 px-2 text-[11px] transition-colors', armed ? armedCls : tones[tone], className)}>
      {armed ? confirmLabel : children}
    </Button>
  )
}

// 14-day dual-series bar chart, pure divs — no chart deps.
export function GrowthChart({ series }: { series: { label: string; signups: number; posts: number }[] }) {
  const max = Math.max(1, ...series.map((s) => Math.max(s.signups, s.posts)))
  return (
    <div className={cn(panelCls, 'p-4')}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">14-day pulse</span>
        <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-amber-400 inline-block" /> signups</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-rose-400 inline-block" /> community</span>
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-28">
        {series.map((s, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="w-full flex items-end justify-center gap-0.5 h-24">
              <div
                className="w-1/2 max-w-[14px] rounded-t-sm bg-gradient-to-t from-amber-500/50 to-amber-300 min-h-[2px]"
                style={{ height: `${(s.signups / max) * 100}%` }}
              />
              <div
                className="w-1/2 max-w-[14px] rounded-t-sm bg-gradient-to-t from-rose-500/50 to-rose-300 min-h-[2px]"
                style={{ height: `${(s.posts / max) * 100}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-zinc-600">{s.label}</span>
            <div className="pointer-events-none absolute -top-7 z-10 hidden group-hover:block whitespace-nowrap rounded bg-zinc-900 border border-white/15 px-2 py-0.5 text-[10px] font-mono text-zinc-200">
              {s.signups} signups · {s.posts} posts
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
