'use client'

// ─── Basement · Control Centre shell ─────────────────────────────────────────
// The "next level" ops interface: deep plum-black terminal aesthetic with
// amber/rose accents, live KPIs, growth pulse, and five operating tabs.
// Mounted ONLY after successful operator authentication.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Building2, Flame, Gauge, HeartPulse, Loader2, Lock, LogOut, MessageSquare,
  Newspaper, Radio, RefreshCw, ScrollText, Settings2, ShieldAlert, Smartphone, Sparkles, Users, Wallet, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  BasementOperator, DarkBadge, GrowthChart, KpiCard, fmtNum, fmtRelative,
  makeAdminFetch, panelCls,
} from './basement-shared'
import { BasementUsers } from './basement-users'
import { BasementModeration, BasementAudit, BasementBroadcast } from './basement-ops'
import { BasementRevenue } from './basement-revenue'
import { BasementContent } from './basement-content'
import { BasementTeam } from './team-hq'
import { BasementConfig } from './basement-config'

type TabKey = 'overview' | 'users' | 'moderation' | 'revenue' | 'content' | 'team' | 'config' | 'audit' | 'broadcast'

const TABS: { key: TabKey; label: string; icon: typeof Gauge }[] = [
  { key: 'overview', label: 'Overview', icon: Gauge },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'moderation', label: 'Moderation', icon: ShieldAlert },
  { key: 'revenue', label: 'Revenue', icon: Wallet },
  { key: 'content', label: 'Content', icon: Newspaper },
  { key: 'team', label: 'Team HQ', icon: Building2 },
  { key: 'config', label: 'Config', icon: Settings2 },
  { key: 'audit', label: 'Audit', icon: ScrollText },
  { key: 'broadcast', label: 'Broadcast', icon: Radio },
]

interface Overview {
  kpis: {
    users: Record<string, number>
    content: Record<string, number>
    engagement: Record<string, number>
  }
  series: { date: string; label: string; signups: number; posts: number }[]
  latestUsers: {
    id: string; name: string | null; email: string; provider: string
    accountStatus: string; subscriptionTier: string | null
    lastLoginAt: string | null; createdAt: string
  }[]
  latestPosts: {
    id: string; title: string; category: string; likes: number; hidden: boolean
    reportedCount: number; createdAt: string
    user: { name: string | null; email: string }
  }[]
  health: { dbLatencyMs: number; serverTime: string; sessionExpiresAt: string | null }
  operator: BasementOperator
}

export function ControlCentre({
  token,
  operator,
  onLock,
  onClose,
}: {
  token: string
  operator: BasementOperator
  onLock: () => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<TabKey>('overview')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [locking, setLocking] = useState(false)
  const [clock, setClock] = useState('')

  const onExpired = useCallback(() => {
    toast.error('Basement session expired — authenticate again.')
    onLock()
  }, [onLock])

  const adminFetch = useMemo(() => makeAdminFetch(token, onExpired), [token, onExpired])

  const loadOverview = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminFetch<Overview>('/api/admin/overview')
      setOverview(data)
    } catch {
      /* onExpired already handles the fatal case */
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => { void loadOverview() }, [loadOverview])

  // 60s auto-refresh while the overview tab is open + ops clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-IN', { hour12: false }))
    tick()
    const clockTimer = setInterval(tick, 1000)
    const refreshTimer = setInterval(() => {
      if (tab === 'overview') void loadOverview()
    }, 60_000)
    return () => { clearInterval(clockTimer); clearInterval(refreshTimer) }
  }, [tab, loadOverview])

  // Escape closes the basement overlay
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const lock = async () => {
    setLocking(true)
    try {
      await adminFetch('/api/admin/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'revoke_own_session' }),
      })
    } catch { /* session may already be gone */ }
    setLocking(false)
    onLock()
  }

  const k = overview?.kpis
  const sessionCountdown = useMemo(() => {
    const exp = overview?.health.sessionExpiresAt
    if (!exp) return null
    const ms = new Date(exp).getTime() - Date.now()
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    return `${h}h ${m}m`
  }, [overview?.health.sessionExpiresAt, clock])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[190] flex flex-col"
      style={{ background: 'radial-gradient(1000px 500px at 50% -10%, rgba(120,53,79,0.16), transparent 55%), #0a0810' }}
      role="dialog" aria-label="Nuvia basement control centre"
    >
      {/* scanline texture */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 3px)' }} />

      {/* ── Header ── */}
      <header className="relative flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-400/10">
          <Lock className="h-3.5 w-3.5 text-amber-300" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-300/80">Basement · Level −1</p>
          <p className="truncate text-sm font-semibold text-zinc-100">
            Nuvia Control Centre
            <span className="ml-2 font-mono text-[10px] font-normal text-zinc-500">
              {operator.name} · {operator.role}
            </span>
          </p>
          <p className="hidden text-[10px] text-zinc-600 sm:block">HQ · full-platform command</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden font-mono text-xs tabular-nums text-zinc-500 sm:block">{clock}</span>
          {sessionCountdown && <DarkBadge tone="gold">session {sessionCountdown}</DarkBadge>}
          <Button variant="outline" size="sm" onClick={() => void loadOverview()} disabled={loading}
            className="h-8 border-white/15 bg-transparent text-zinc-300 hover:bg-white/5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void lock()} disabled={locking}
            className="h-8 border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20">
            {locking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Lock</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close basement"
            className="h-8 px-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ── Tab rail ── */}
      <nav className="relative flex items-center gap-1 overflow-x-auto border-b border-white/10 px-3 py-1.5" aria-label="Basement sections">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? 'text-amber-300' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {active && (
                <motion.span layoutId="basement-tab" className="absolute inset-0 rounded-lg border border-amber-400/30 bg-amber-400/10"
                  transition={{ type: 'spring', damping: 28, stiffness: 350 }} />
              )}
              <Icon className="relative h-3.5 w-3.5" />
              <span className="relative">{t.label}</span>
            </button>
          )
        })}
      </nav>

      {/* ── Content ── */}
      <ScrollArea className="relative flex-1">
        <div className="mx-auto max-w-6xl p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {tab === 'overview' && (
                overview ? (
                  <div className="space-y-4">
                    {/* KPI grid — users */}
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                      <KpiCard label="total users" value={fmtNum(k.users.total)} sub={`${fmtNum(k.users.new7d)} new this week`} icon={<Users className="h-3.5 w-3.5" />} />
                      <KpiCard label="active 24h" value={fmtNum(k.users.active24h)} sub={`${fmtNum(k.users.active7d)} this week`} tone="emerald" icon={<Activity className="h-3.5 w-3.5" />} />
                      <KpiCard label="premium" value={fmtNum(k.users.premium)} sub={`${fmtNum(k.users.trialing)} trialing`} tone="gold" icon={<Sparkles className="h-3.5 w-3.5" />} />
                      <KpiCard label="suspended/banned" value={`${fmtNum(k.users.suspended)} / ${fmtNum(k.users.banned)}`} sub={`${fmtNum(k.users.flagged)} flagged`} tone="rose" />
                      <KpiCard label="google / email" value={`${fmtNum(k.users.google)} / ${fmtNum(k.users.email)}`} sub={`${Math.round((k.users.onboarded / Math.max(1, k.users.total)) * 100)}% onboarded`} />
                      <KpiCard label="open reports" value={fmtNum(k.content.openReports)} sub="community queue" tone={k.content.openReports > 0 ? 'danger' : 'emerald'} icon={<ShieldAlert className="h-3.5 w-3.5" />} />
                    </div>

                    {/* KPI grid — content + engagement */}
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
                      <KpiCard label="posts" value={fmtNum(k.content.posts)} />
                      <KpiCard label="comments" value={fmtNum(k.content.comments)} />
                      <KpiCard label="likes" value={fmtNum(k.content.likes)} />
                      <KpiCard label="hidden" value={fmtNum(k.content.hiddenPosts + k.content.hiddenComments)} tone={k.content.hiddenPosts + k.content.hiddenComments > 0 ? 'rose' : 'default'} />
                      <KpiCard label="cycles" value={fmtNum(k.engagement.cycles)} icon={<HeartPulse className="h-3.5 w-3.5" />} />
                      <KpiCard label="symptoms" value={fmtNum(k.engagement.symptoms)} />
                      <KpiCard label="AI chats" value={fmtNum(k.engagement.chats)} icon={<MessageSquare className="h-3.5 w-3.5" />} />
                      <KpiCard label="push devices" value={fmtNum(k.engagement.pushDevices)} icon={<Smartphone className="h-3.5 w-3.5" />} />
                    </div>

                    {/* Growth pulse */}
                    <GrowthChart series={overview.series} />

                    {/* Recent + health */}
                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className={panelCls + ' p-4'}>
                        <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Latest signups</p>
                        <div className="space-y-1.5">
                          {overview.latestUsers.map((u) => (
                            <div key={u.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-400/15 text-[10px] font-semibold text-rose-200">
                                {(u.name ?? u.email)[0]?.toUpperCase()}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs text-zinc-300">{u.name ?? '—'} <span className="font-mono text-[10px] text-zinc-600">{u.email}</span></span>
                              </span>
                              {u.subscriptionTier === 'premium' && u.accountStatus === 'active' && <DarkBadge tone="gold">pro</DarkBadge>}
                              {u.accountStatus !== 'active' && <DarkBadge tone="danger">{u.accountStatus}</DarkBadge>}
                              <span className="font-mono text-[10px] text-zinc-600">{fmtRelative(u.createdAt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className={panelCls + ' p-4'}>
                          <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Latest community posts</p>
                          {overview.latestPosts.length === 0 ? (
                            <p className="text-xs text-zinc-600">No posts yet.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {overview.latestPosts.map((p) => (
                                <div key={p.id} className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                                  <p className="truncate text-xs text-zinc-300">{p.title}</p>
                                  <p className="font-mono text-[10px] text-zinc-600">
                                    {p.user.name ?? p.user.email} · {p.category} · ♥ {p.likes}
                                    {p.hidden ? ' · hidden' : ''}{p.reportedCount > 0 ? ` · ${p.reportedCount} reports` : ''}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className={panelCls + ' p-4'}>
                          <p className="mb-2.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                            <Flame className="h-3 w-3 text-amber-300" /> System health
                          </p>
                          <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-zinc-300">
                            <span className="flex items-center gap-1.5">
                              <i className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" /> DB {overview.health.dbLatencyMs}ms
                            </span>
                            <span>notif sent: {fmtNum(k.engagement.notifications)}</span>
                            <span>appointments: {fmtNum(k.engagement.appointments)}</span>
                            <span>moods: {fmtNum(k.engagement.moods)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-24 text-sm text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Decrypting platform pulse…
                  </div>
                )
              )}

              {tab === 'users' && <BasementUsers adminFetch={adminFetch} onUsersChanged={loadOverview} />}
              {tab === 'moderation' && <BasementModeration adminFetch={adminFetch} />}
              {tab === 'revenue' && <BasementRevenue adminFetch={adminFetch} />}
              {tab === 'content' && <BasementContent adminFetch={adminFetch} />}
              {tab === 'team' && <BasementTeam adminFetch={adminFetch} />}
              {tab === 'config' && <BasementConfig adminFetch={adminFetch} />}
              {tab === 'audit' && <BasementAudit adminFetch={adminFetch} />}
              {tab === 'broadcast' && (
                <BasementBroadcast adminFetch={adminFetch} estimatedRecipients={Math.max(0, (k?.users.total ?? 0) - (k?.users.banned ?? 0))} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </ScrollArea>
    </motion.div>
  )
}
