'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Check, Loader2, MoonStar, Sparkles } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ─── Period Reminders & Quiet Hours (Settings section) ───────────────────────
// Persists to User.remindersEnabled / quietStart / quietEnd via PATCH
// /api/user/preferences. The reminder engine (src/lib/reminders.ts) enforces
// the window in both the per-user check and the 15-min server sweep.

interface Prefs {
  remindersEnabled: boolean
  quietStart: number | null
  quietEnd: number | null
  quietNow?: boolean
}

const QUIET_PRESETS: { label: string; start: number; end: number }[] = [
  { label: '22:00 → 07:00', start: 22, end: 7 },
  { label: '23:00 → 08:00', start: 23, end: 8 },
  { label: '21:00 → 06:00', start: 21, end: 6 },
]

function hourLabel(h: number | null): string {
  if (h == null) return '—'
  return `${String(h).padStart(2, '0')}:00`
}

export default function ReminderPreferences() {
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/user/preferences')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && typeof d.remindersEnabled === 'boolean') {
          setPrefs({ remindersEnabled: d.remindersEnabled, quietStart: d.quietStart ?? null, quietEnd: d.quietEnd ?? null, quietNow: d.quietNow })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const save = async (patch: Partial<Pick<Prefs, 'remindersEnabled' | 'quietStart' | 'quietEnd'>>) => {
    if (!prefs || saving) return
    const prev = prefs
    const next = { ...prev, ...patch }
    setPrefs(next)
    setSaving(true)
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      if (d?.preferences) {
        setPrefs({
          remindersEnabled: d.preferences.remindersEnabled,
          quietStart: d.preferences.quietStart ?? null,
          quietEnd: d.preferences.quietEnd ?? null,
          quietNow: d.preferences.quietNow,
        })
      }
      toast.success('Reminder preferences saved')
    } catch {
      setPrefs(prev)
      toast.error('Could not save — please try again')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading reminder settings…
      </div>
    )
  }

  if (!prefs) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Sign in to manage period reminders and quiet hours.
      </p>
    )
  }

  const hasWindow = prefs.quietStart != null && prefs.quietEnd != null

  return (
    <div className="space-y-4">
      {/* Master toggle */}
      <div className="flex items-center gap-3 py-2 px-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg shrink-0 transition-colors',
            prefs.remindersEnabled
              ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {prefs.remindersEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Period reminders</div>
          <div className="text-xs text-muted-foreground">
            Get alerted when your period is expected — even with the app closed
          </div>
        </div>
        <Switch
          checked={prefs.remindersEnabled}
          onCheckedChange={(v) => save({ remindersEnabled: v })}
          disabled={saving}
          aria-label="Toggle period reminders"
        />
      </div>

      {/* Quiet hours */}
      <div
        className={cn(
          'rounded-xl border p-3 transition-opacity',
          prefs.remindersEnabled ? '' : 'opacity-50 pointer-events-none'
        )}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <MoonStar className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-medium">Quiet hours</span>
          {prefs.quietNow && (
            <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Quiet now
            </span>
          )}
          {!prefs.quietNow && hasWindow && (
            <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
              {hourLabel(prefs.quietStart)} → {hourLabel(prefs.quietEnd)}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          No reminders are delivered during quiet hours — they arrive shortly after the window ends.
        </p>

        {/* Preset chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            onClick={() => save({ quietStart: null, quietEnd: null })}
            disabled={saving}
            className={cn(
              'text-xs px-2.5 py-1.5 rounded-full border transition-all',
              !hasWindow
                ? 'bg-primary text-primary-foreground border-transparent font-medium shadow-sm'
                : 'border-border hover:bg-accent text-foreground'
            )}
          >
            Off (24/7)
          </button>
          {QUIET_PRESETS.map((p) => {
            const active = prefs.quietStart === p.start && prefs.quietEnd === p.end
            return (
              <button
                key={p.label}
                onClick={() => save({ quietStart: p.start, quietEnd: p.end })}
                disabled={saving}
                className={cn(
                  'text-xs px-2.5 py-1.5 rounded-full border transition-all tabular-nums',
                  active
                    ? 'bg-primary text-primary-foreground border-transparent font-medium shadow-sm'
                    : 'border-border hover:bg-accent text-foreground'
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        {/* Custom window */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Custom:</span>
          <Select
            value={prefs.quietStart != null ? String(prefs.quietStart) : 'none'}
            onValueChange={(v) => {
              const start = v === 'none' ? null : Number(v)
              save({ quietStart: start, quietEnd: prefs.quietEnd ?? (start != null ? 7 : null) })
            }}
          >
            <SelectTrigger size="sm" className="h-8 flex-1 text-xs" aria-label="Quiet hours start">
              <SelectValue placeholder="From" />
            </SelectTrigger>
            <SelectContent className="max-h-56">
              <SelectItem value="none">No window</SelectItem>
              {Array.from({ length: 24 }, (_, h) => (
                <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground shrink-0">→</span>
          <Select
            value={prefs.quietEnd != null ? String(prefs.quietEnd) : 'none'}
            onValueChange={(v) => {
              const end = v === 'none' ? null : Number(v)
              save({ quietEnd: end, quietStart: prefs.quietStart ?? (end != null ? 22 : null) })
            }}
          >
            <SelectTrigger size="sm" className="h-8 flex-1 text-xs" aria-label="Quiet hours end">
              <SelectValue placeholder="To" />
            </SelectTrigger>
            <SelectContent className="max-h-56">
              <SelectItem value="none">No window</SelectItem>
              {Array.from({ length: 24 }, (_, h) => (
                <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status footer */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        {saving ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </>
        ) : (
          <>
            <Check className="h-3 w-3 text-emerald-500" />
            {prefs.remindersEnabled
              ? hasWindow
                ? `Reminders pause ${hourLabel(prefs.quietStart)} → ${hourLabel(prefs.quietEnd)}`
                : 'Reminders on around the clock'
              : 'Reminders are off'}
          </>
        )}
        <Sparkles className="h-3 w-3 ml-auto text-amber-400" />
      </div>
    </div>
  )
}
