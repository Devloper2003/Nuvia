'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  CalendarDays,
  Sparkles,
  Stethoscope,
  Users,
  Droplets,
  X,
  Loader2,
  HeartHandshake,
  MoonStar,
  ChevronDown,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface AppNotification {
  id: string
  title: string
  message: string
  type: string // period_reminder | medication | appointment | insight | community
  read: boolean
  createdAt: string
}

interface NotificationPanelProps {
  userId: string
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  period_reminder: { icon: CalendarDays, color: 'text-rose-600 dark:text-rose-300', bg: 'bg-rose-50 dark:bg-rose-950/40', label: 'Cycle' },
  medication: { icon: Droplets, color: 'text-sky-600 dark:text-sky-300', bg: 'bg-sky-50 dark:bg-sky-950/40', label: 'Medication' },
  appointment: { icon: Stethoscope, color: 'text-teal-600 dark:text-teal-300', bg: 'bg-teal-50 dark:bg-teal-950/40', label: 'Appointment' },
  insight: { icon: Sparkles, color: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/40', label: 'Insight' },
  community: { icon: Users, color: 'text-violet-600 dark:text-violet-300', bg: 'bg-violet-50 dark:bg-violet-950/40', label: 'Community' },
  system: { icon: HeartHandshake, color: 'text-primary', bg: 'bg-primary/10 dark:bg-primary/20', label: 'Nuvia' },
}

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  ...Object.entries(TYPE_CONFIG).map(([key, cfg]) => ({ key, label: cfg.label })),
]

// RFC 7515-ish: the VAPID public key arrives base64url-encoded and must be
// converted to the Uint8Array applicationServerKey that pushManager wants.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

type PushState = 'checking' | 'unsupported' | 'unconfigured' | 'prompt' | 'subscribing' | 'subscribed' | 'denied'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Grouping buckets for the full notifications center
function groupKey(iso: string): 'Today' | 'Yesterday' | 'Earlier' {
  const t = new Date(iso).getTime()
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (t >= startOfToday) return 'Today'
  if (t >= startOfToday - 86_400_000) return 'Yesterday'
  return 'Earlier'
}

/* ─── Skeleton rows shown while fetching ─────────────────────────────────── */

function RowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 animate-pulse" aria-hidden="true">
      <div className="h-10 w-10 shrink-0 rounded-2xl bg-muted" />
      <div className="flex-1 min-w-0 space-y-2 pt-0.5">
        <div className="h-3.5 w-3/5 rounded-full bg-muted" />
        <div className="h-3 w-full rounded-full bg-muted/70" />
        <div className="h-3 w-2/3 rounded-full bg-muted/50" />
      </div>
    </div>
  )
}

/* ─── A single notification row (shared by preview + center) ─────────────── */
/* Rows are divs with role="button" so the "More/Less" expander inside can be
   a real button (nested buttons are invalid HTML and break screen readers). */

function NotificationRow({
  n,
  index,
  onRead,
}: {
  n: AppNotification
  index: number
  onRead: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.insight
  const Icon = cfg.icon
  const isLong = n.message.length > 96

  const activate = () => {
    if (!n.read) onRead(n.id)
  }

  return (
    <motion.div
      key={n.id}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.2 }}
      role="button"
      tabIndex={0}
      aria-label={n.read ? n.title : `${n.title} — unread, tap to mark as read`}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate()
        }
      }}
      className={cn(
        'group relative w-full flex items-start gap-3 px-4 py-3.5 text-left cursor-pointer',
        'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        'transition-colors select-none min-h-[68px]',
        !n.read
          ? n.type === 'period_reminder'
            ? 'bg-rose-500/[0.06] hover:bg-rose-500/[0.10]'
            : 'bg-primary/[0.04] hover:bg-primary/[0.08]'
          : 'hover:bg-accent/50'
      )}
    >
      {/* Unread accent bar — integrated inside the row (fixes floating dots) */}
      {!n.read && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-gradient-to-b from-rose-400 via-rose-500 to-primary shadow-sm"
        />
      )}

      <div className={cn('h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]', cfg.bg)}>
        <Icon className={cn('h-[18px] w-[18px]', cfg.color)} />
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn('text-[13px] leading-snug min-w-0', !n.read ? 'font-semibold text-foreground' : 'font-medium text-foreground/85')}>
            {n.title}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
            {timeAgo(n.createdAt)}
          </span>
        </div>

        <p className={cn('text-xs text-muted-foreground mt-1 leading-relaxed', !expanded && 'line-clamp-2')}>
          {n.message}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
            className="mt-1 inline-flex min-h-8 items-center gap-0.5 text-[11px] font-medium text-primary hover:underline rounded"
            aria-expanded={expanded}
          >
            {expanded ? 'Less' : 'More'}
            <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
          </button>
        )}

        <div className="mt-1.5 flex items-center gap-1.5">
          <span className={cn('inline-block text-[10px] font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.color)}>
            {cfg.label}
          </span>
          {n.read && <span className="text-[10px] text-muted-foreground/60">· read</span>}
        </div>
      </div>

      {!n.read && (
        <span
          className="mt-1.5 shrink-0 h-5 w-5 rounded-full border border-primary/30 text-primary/50 hidden sm:items-center sm:justify-center sm:flex group-hover:border-primary group-hover:text-primary group-hover:bg-primary/10 transition-colors"
          aria-hidden="true"
        >
          <Check className="h-3 w-3" />
        </span>
      )}
    </motion.div>
  )
}

/* ─── Panel header (title, status chips, actions) ─────────────────────────── */

function PanelHeader({
  unreadCount,
  quietNow,
  pushState,
  onEnableReminders,
  onMarkAllRead,
  markingAll,
  showClose,
  onClose,
  centerControls,
}: {
  unreadCount: number
  quietNow: boolean
  pushState: PushState
  onEnableReminders: () => void
  onMarkAllRead: () => void
  markingAll: boolean
  showClose?: boolean
  onClose?: () => void
  centerControls?: React.ReactNode
}) {
  return (
    <div className="shrink-0 border-b border-border bg-gradient-to-r from-gold-soft/50 via-background to-primary/[0.04] dark:from-gold-soft/10 dark:via-background dark:to-primary/10 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Bell className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-semibold tracking-tight truncate">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white shadow-sm shadow-rose-500/30 shrink-0">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {centerControls}
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              disabled={markingAll}
              className="inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
              title="Mark all as read"
            >
              {markingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              <span>Mark all read</span>
            </button>
          )}
          {showClose && (
            <button
              onClick={onClose}
              className="h-9 w-9 inline-flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground transition-colors"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {(quietNow || pushState === 'prompt' || pushState === 'subscribed') && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {quietNow && (
            <span
              className="text-[10px] font-medium text-indigo-600 dark:text-indigo-300 flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-1 min-h-6"
              title="Quiet hours are active — reminders pause until the window ends"
            >
              <MoonStar className="h-3 w-3" />
              Quiet hours
            </span>
          )}
          {pushState === 'prompt' && (
            <button
              onClick={onEnableReminders}
              disabled={pushState === 'subscribing'}
              className="hover-wiggle text-[11px] font-medium text-primary hover:bg-primary/15 disabled:opacity-50 flex items-center gap-1 rounded-full bg-primary/10 px-2.5 min-h-8 transition-colors"
              title="Get notified before your period, even when the app is closed"
            >
              {pushState === 'subscribing' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <BellRing className="wiggle-target h-3 w-3" />
              )}
              <span>Enable reminders</span>
            </button>
          )}
          {pushState === 'subscribed' && (
            <span
              className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 min-h-6"
              title="Push reminders are active on this device"
            >
              <BellRing className="h-3 w-3" />
              Reminders on
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Shared list body ────────────────────────────────────────────────────── */

function NotificationList({
  items,
  loading,
  onRead,
  grouped,
  emptyTitle,
  emptyBody,
}: {
  items: AppNotification[]
  loading: boolean
  onRead: (id: string) => void
  grouped?: boolean
  emptyTitle: string
  emptyBody: string
}) {
  if (loading) {
    return (
      <div className="py-1">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="relative mx-auto mb-4 h-16 w-16">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gold-soft/70 to-primary/10 dark:from-gold-soft/20 dark:to-primary/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Bell className="h-6 w-6 text-primary/70" />
          </div>
          <Sparkles className="absolute -right-0.5 -top-0.5 h-4 w-4 text-gold" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold">{emptyTitle}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto leading-relaxed">{emptyBody}</p>
      </div>
    )
  }

  if (!grouped) {
    return (
      <div className="divide-y divide-border/60">
        {items.map((n, idx) => (
          <NotificationRow key={n.id} n={n} index={idx} onRead={onRead} />
        ))}
      </div>
    )
  }

  const buckets: { label: string; items: AppNotification[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Earlier', items: [] },
  ]
  for (const n of items) buckets.find((b) => b.label === groupKey(n.createdAt))!.items.push(n)

  let flat = -1
  return (
    <div>
      {buckets
        .filter((b) => b.items.length > 0)
        .map((bucket) => (
          <section key={bucket.label} aria-label={bucket.label}>
            <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border/40 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {bucket.label}
            </div>
            <div className="divide-y divide-border/60">
              {bucket.items.map((n) => {
                flat += 1
                return <NotificationRow key={n.id} n={n} index={flat} onRead={onRead} />
              })}
            </div>
          </section>
        ))}
    </div>
  )
}

/* ─── Full notifications center body (filters + groups + maintenance) ────── */

function NotificationCenterBody({
  notifications,
  loading,
  unreadCount,
  onRead,
  onMarkAllRead,
  markingAll,
  onClearRead,
  clearingRead,
  onRefresh,
  refreshing,
}: {
  notifications: AppNotification[]
  loading: boolean
  unreadCount: number
  onRead: (id: string) => void
  onMarkAllRead: () => void
  markingAll: boolean
  onClearRead: () => void
  clearingRead: boolean
  onRefresh: () => void
  refreshing: boolean
}) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = useMemo(
    () => (filter === 'all' ? notifications : notifications.filter((n) => n.type === filter)),
    [filter, notifications]
  )
  const readCount = notifications.length - unreadCount

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Filter chips */}
      <div className="shrink-0 border-b border-border/60 px-3 py-2.5">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter notifications by type">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                'min-h-9 rounded-full px-3 text-xs font-medium transition-all',
                filter === f.key
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped list */}
      <div className="flex-1 min-h-0 overflow-y-auto chandracycle-scroll overscroll-contain">
        <NotificationList
          items={filtered}
          loading={loading}
          onRead={onRead}
          grouped
          emptyTitle={filter === 'all' ? "You're all caught up" : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} notifications`}
          emptyBody={filter === 'all' ? 'New cycle reminders, insights and community updates will land here.' : 'Try a different filter to see more of your history.'}
        />
      </div>

      {/* Maintenance footer */}
      <div className="shrink-0 border-t border-border bg-muted/30 px-3 py-2.5 pb-[max(env(safe-area-inset-bottom),0.625rem)] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClearRead}
          disabled={clearingRead || readCount === 0}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 disabled:opacity-40 disabled:hover:text-muted-foreground disabled:hover:bg-transparent transition-colors"
          title={readCount === 0 ? 'Nothing read to clear yet' : 'Remove all read notifications'}
        >
          {clearingRead ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Clear read
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export default function NotificationPanel({ userId }: NotificationPanelProps) {
  const [open, setOpen] = useState(false) // preview dropdown (desktop) / sheet (mobile)
  const [centerOpen, setCenterOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [clearingRead, setClearingRead] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pushState, setPushState] = useState<PushState>('checking')
  const [quietNow, setQuietNow] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  const unreadCount = notifications.filter((n) => !n.read).length

  const fetchNotifications = useCallback(
    async (opts?: { silent?: boolean; seed?: boolean }) => {
      if (!userId) return
      if (!opts?.silent) setLoading(true)
      try {
        // Seed data-driven nudges ONLY on the initial mount fetch. Re-seeding
        // on every panel open would resurrect cleared reminders instantly and
        // make "Clear read" feel broken. The route itself de-dupes per day.
        if (opts?.seed) {
          await fetch('/api/notifications/seed', { method: 'POST' }).catch(() => {})
        }
        const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`)
        const data = await res.json()
        setNotifications(Array.isArray(data) ? data : [])
      } catch {
        setNotifications([])
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [userId]
  )

  // ─── Period reminder engine (server-side) ───────────────────────────
  // Runs once when the panel mounts: asks the server whether the user's
  // period is due soon / late. If a reminder fires, the bell list refreshes
  // and a local notification is shown (when permission was already granted).
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const runCheck = async () => {
      try {
        const res = await fetch('/api/notifications/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled || !data?.triggered) return
        fetchNotifications()
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            const reg = await navigator.serviceWorker?.getRegistration()
            if (reg) {
              await reg.showNotification(data.notification.title, {
                body: data.notification.message,
                icon: '/icon-maskable.svg',
                badge: '/icon.svg',
                tag: 'chandracycle-period-reminder',
              })
            }
          } catch {
            /* local notification is best-effort */
          }
        }
      } catch {
        /* reminder check is best-effort */
      }
    }
    runCheck()
    return () => {
      cancelled = true
    }
  }, [userId, fetchNotifications])

  // ─── Quiet-hours probe (shows a soft chip while the window is active) ──
  useEffect(() => {
    let cancelled = false
    fetch('/api/user/preferences')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && typeof d.quietNow === 'boolean') setQuietNow(d.quietNow)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  // ─── Push subscription status probe ─────────────────────────────
  useEffect(() => {
    let cancelled = false
    const probe = async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (!cancelled) setPushState('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setPushState('denied')
        return
      }
      try {
        const res = await fetch(`/api/push?userId=${encodeURIComponent(userId)}`)
        const data = await res.json()
        if (cancelled) return
        if (!data.configured || !data.publicKey) {
          setPushState('unconfigured')
        } else if (data.subscribed) {
          setPushState('subscribed')
        } else {
          setPushState('prompt')
        }
      } catch {
        if (!cancelled) setPushState('unconfigured')
      }
    }
    probe()
    return () => {
      cancelled = true
    }
  }, [userId])

  // ─── Enable reminders: permission → subscribe → register → test ───────
  const enableReminders = async () => {
    if (pushState === 'subscribing') return
    setPushState('subscribing')
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'denied') {
        setPushState('denied')
        toast.error('Notifications are blocked. Enable them for this site in your browser settings.')
        return
      }

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const keyRes = await fetch('/api/push')
      const { publicKey } = await keyRes.json()
      if (!publicKey) throw new Error('Push is not configured on the server')

      const existing = await reg.pushManager.getSubscription()
      const subscription =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }))

      const saveRes = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subscription: subscription.toJSON() }),
      })
      if (!saveRes.ok) throw new Error('Could not save your notification subscription')

      setPushState('subscribed')
      toast.success('Reminders enabled! You will be alerted before your period.')

      // Friendly confirmation ping on the user's own device
      void fetch('/api/push', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }).catch(() => {})
    } catch (e) {
      setPushState(Notification.permission === 'granted' ? 'prompt' : 'denied')
      toast.error(e instanceof Error ? e.message : 'Could not enable reminders')
    }
  }

  // Fetch on mount (+ seed nudges once per page load); refresh without re-seed when preview opens
  useEffect(() => {
    fetchNotifications({ seed: true })
  }, [fetchNotifications])

  useEffect(() => {
    if (open) fetchNotifications()
  }, [open, fetchNotifications])

  // Desktop dropdown: close on outside click (mobile uses a sheet with overlay)
  useEffect(() => {
    if (!open || isMobile) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, isMobile])

  // Desktop dropdown: close on Escape (sheet/dialog close natively)
  useEffect(() => {
    if (!open || isMobile) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isMobile])

  // Avoid stuck states when the viewport crosses the breakpoint
  useEffect(() => {
    setOpen(false)
  }, [isMobile])

  const markOneRead = async (id: string) => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    try {
      await fetch('/api/notifications/read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, userId }),
      })
    } catch {
      // revert on failure
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)))
    }
  }

  const markAllRead = async () => {
    if (unreadCount === 0 || markingAll) return
    setMarkingAll(true)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await fetch('/api/notifications/read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true, userId }),
      })
      toast.success('All notifications marked as read')
    } catch {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: false })))
    } finally {
      setMarkingAll(false)
    }
  }

  const clearRead = async () => {
    if (clearingRead) return
    const readCount = notifications.filter((n) => n.read).length
    if (readCount === 0) return
    setClearingRead(true)
    const snapshot = notifications
    setNotifications((prev) => prev.filter((n) => !n.read))
    try {
      const res = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Cleared ${readCount} read notification${readCount === 1 ? '' : 's'}`)
    } catch {
      setNotifications(snapshot)
      toast.error('Could not clear read notifications')
    } finally {
      setClearingRead(false)
    }
  }

  const refreshSilent = async () => {
    setRefreshing(true)
    await fetchNotifications({ silent: true })
    setRefreshing(false)
  }

  const openCenter = () => {
    setOpen(false)
    setCenterOpen(true)
  }

  const headerProps = {
    unreadCount,
    quietNow,
    pushState,
    onEnableReminders: enableReminders,
    onMarkAllRead: markAllRead,
    markingAll,
  }

  const previewList = notifications.slice(0, 6)

  /* ── Bell trigger (44px on mobile, 36px in the dense desktop topbar) ── */
  const trigger = (
    <button
      onClick={() => setOpen((o) => !o)}
      className={cn(
        'relative h-11 w-11 lg:h-9 lg:w-9 inline-flex items-center justify-center rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'hover:bg-accent text-foreground/70 hover:text-foreground',
        open && 'bg-accent text-foreground'
      )}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      aria-expanded={open}
      aria-haspopup="dialog"
    >
      <Bell className={cn('h-5 w-5 lg:h-[18px] lg:w-[18px] transition-transform', open && 'rotate-[-8deg]')} />
      {unreadCount > 0 && (
        <motion.span
          key={unreadCount}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 text-white text-[10px] font-bold flex items-center justify-center shadow-md shadow-rose-500/40 ring-2 ring-background"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </motion.span>
      )}
      {unreadCount > 0 && (
        <span className="absolute inset-0 rounded-full animate-ping bg-rose-500/20" aria-hidden="true" />
      )}
    </button>
  )

  return (
    <div className="relative" ref={containerRef}>
      {trigger}

      {/* ── Mobile: bottom sheet (swipe-to-dismiss, safe-area aware) ── */}
      {isMobile && (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent
            aria-label="Notifications"
            className="max-h-[85dvh] rounded-t-3xl bg-card border-t-0 outline-none focus-visible:ring-0"
          >
            {/* vaul is built on Radix Dialog — it needs a title for a11y */}
            <DrawerTitle className="sr-only">Notifications</DrawerTitle>
            <DrawerDescription className="sr-only">Your latest cycle reminders and updates</DrawerDescription>
            <PanelHeader {...headerProps} />
            <div className="flex-1 min-h-0 overflow-y-auto chandracycle-scroll overscroll-contain">
              <NotificationList
                items={previewList}
                loading={loading}
                onRead={markOneRead}
                emptyTitle="You're all caught up"
                emptyBody="New cycle reminders, insights and community updates will land here."
              />
            </div>
            {/* Footer CTA — full-width plum pill, respects home-indicator inset */}
            <div className="shrink-0 border-t border-border px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] bg-gradient-to-r from-gold-soft/30 to-transparent dark:from-gold-soft/10">
              <button
                onClick={openCenter}
                className="btn-plum w-full h-11 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                View all notifications
                {notifications.length > 6 && (
                  <span className="text-[10px] font-bold bg-white/20 rounded-full px-1.5 py-0.5">
                    {notifications.length}
                  </span>
                )}
              </button>
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* ── Desktop/tablet: anchored glass dropdown ── */}
      {!isMobile && (
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-2 w-[min(400px,calc(100vw-2rem))] z-50"
            >
              <div
                id="notifications-dropdown"
                role="dialog"
                aria-label="Notifications"
                className="rounded-3xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/10 overflow-hidden"
              >
                <PanelHeader {...headerProps} showClose onClose={() => setOpen(false)} />
                <div className="max-h-[min(480px,calc(100dvh-10rem))] overflow-y-auto chandracycle-scroll overscroll-contain">
                  <NotificationList
                    items={previewList}
                    loading={loading}
                    onRead={markOneRead}
                    emptyTitle="You're all caught up"
                    emptyBody="New cycle reminders, insights and community updates will land here."
                  />
                </div>
                <div className="shrink-0 border-t border-border px-4 py-2.5 bg-gradient-to-r from-gold-soft/30 to-transparent dark:from-gold-soft/10">
                  <button
                    onClick={openCenter}
                    className="btn-plum w-full h-10 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2"
                  >
                    View all notifications
                    {notifications.length > 6 && (
                      <span className="text-[10px] font-bold bg-white/20 rounded-full px-1.5 py-0.5">
                        {notifications.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ── Full notifications center ── */}
      {isMobile ? (
        <Drawer open={centerOpen} onOpenChange={setCenterOpen}>
          <DrawerContent
            aria-label="All notifications"
            className="max-h-[92dvh] rounded-t-3xl bg-card border-t-0 outline-none focus-visible:ring-0 flex flex-col"
          >
            <DrawerTitle className="sr-only">All notifications</DrawerTitle>
            <DrawerDescription className="sr-only">
              Browse, filter and manage all your notifications
            </DrawerDescription>
            <PanelHeader
              {...headerProps}
              markingAll={markingAll}
              centerControls={
                <button
                  onClick={refreshSilent}
                  disabled={refreshing}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground transition-colors"
                  aria-label="Refresh notifications"
                >
                  <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                </button>
              }
            />
            <NotificationCenterBody
              notifications={notifications}
              loading={loading}
              unreadCount={unreadCount}
              onRead={markOneRead}
              onMarkAllRead={markAllRead}
              markingAll={markingAll}
              onClearRead={clearRead}
              clearingRead={clearingRead}
              onRefresh={refreshSilent}
              refreshing={refreshing}
            />
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={centerOpen} onOpenChange={setCenterOpen}>
          <DialogContent
            aria-label="All notifications"
            className="max-w-[560px] max-h-[85dvh] p-0 gap-0 overflow-hidden rounded-3xl bg-card flex flex-col"
          >
            {/* Radix a11y: hidden title/description (visible header lives in PanelHeader) */}
            <DialogTitle className="sr-only">All notifications</DialogTitle>
            <DialogDescription className="sr-only">
              Browse, filter and manage all your notifications
            </DialogDescription>
            <PanelHeader {...headerProps} />
            <NotificationCenterBody
              notifications={notifications}
              loading={loading}
              unreadCount={unreadCount}
              onRead={markOneRead}
              onMarkAllRead={markAllRead}
              markingAll={markingAll}
              onClearRead={clearRead}
              clearingRead={clearingRead}
              onRefresh={refreshSilent}
              refreshing={refreshing}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
