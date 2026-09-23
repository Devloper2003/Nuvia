'use client'

// ─── Basement · User Explorer ────────────────────────────────────────────────
// Searchable, filterable directory of every user with a full dossier drawer:
// profile, tracking aggregates, device sessions, recent activity, operator
// notes and account actions (suspend/ban/flag/premium/force-logout/delete).
// SUPER_ADMIN bearer required for every call.

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Ban, CheckCircle2, ChevronRight, Flag, HeartPulse, Loader2, LogOut,
  RefreshCw, Search, ShieldOff, Smartphone, Sparkles, StickyNote, Trash2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DarkBadge, KpiCard, fmtDate, fmtDateTime, fmtNum, fmtRelative,
  inputDarkCls, makeAdminFetch, panelCls,
} from './basement-shared'
import { toast } from 'sonner'

interface UserRow {
  id: string
  name: string | null
  email: string
  avatar: string | null
  provider: string
  accountStatus: string
  flagged: boolean
  banReason: string | null
  onboardingComplete: boolean
  lastLoginAt: string | null
  createdAt: string
  subscriptionTier: string | null
  subscriptionStatus: string | null
  city: string | null
  country: string | null
  _count: { communityPosts: number; comments: number; cycles: number; symptomEntries: number; notifications: number }
}

interface Dossier {
  user: UserRow & {
    phone: string | null; dateOfBirth: string | null; height: number | null; weight: number | null
    cycleLength: number; periodLength: number; lastPeriodStart: string | null
    remindersEnabled: boolean; emailVerified: boolean; notes: string | null
    subscriptionPlan: string | null; subscriptionStart: string | null; subscriptionEnd: string | null
    updatedAt: string
  }
  aggregates: Record<string, number>
  devices: { id: string; deviceInfo: string | null; ipAddress: string | null; location: string | null; createdAt: string; expiresAt: string; revoked: boolean }[]
  recentPosts: { id: string; title: string; category: string; likes: number; hidden: boolean; reportedCount: number; createdAt: string }[]
  recentComments: { id: string; content: string; hidden: boolean; reportedCount: number; createdAt: string; post: { title: string } | null }[]
  recentCycles: { id: string; startDate: string; endDate: string | null }[]
  recentSymptoms: { id: string; date: string; category: string; severity: number; notes: string | null }[]
}

type AdminFetch = <T>(url: string, init?: RequestInit) => Promise<T>

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'banned', label: 'Banned' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'new', label: 'New (7d)' },
  { key: 'premium', label: 'Premium' },
]

export function BasementUsers({ adminFetch, onUsersChanged }: { adminFetch: AdminFetch; onUsersChanged?: () => void }) {
  const [rows, setRows] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [dossierLoading, setDossierLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null)
  const [noteText, setNoteText] = useState('')
  const [acting, setActing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (opts?: { q?: string; status?: string; page?: number }) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const query = opts?.q ?? q
      const st = opts?.status ?? status
      const pg = opts?.page ?? page
      if (query) params.set('q', query)
      if (st) params.set('status', st)
      params.set('page', String(pg))
      const data = await adminFetch<{ users: UserRow[]; total: number; pages: number }>(`/api/admin/users?${params}`)
      setRows(data.users)
      setTotal(data.total)
      setPages(data.pages)
      setPage(pg)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [adminFetch, q, status, page])

  useEffect(() => { void load({ page: 1 }) }, []) // initial

  const onSearchChange = (v: string) => {
    setQ(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void load({ q: v, page: 1 }), 350)
  }

  const openDossier = async (id: string) => {
    setDossierLoading(true)
    setNoteText('')
    try {
      const data = await adminFetch<Dossier>(`/api/admin/users?detail=${id}`)
      setDossier(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load dossier')
    } finally {
      setDossierLoading(false)
    }
  }

  const runAction = async (action: string, extra: Record<string, unknown> = {}, done?: () => void) => {
    setActing(true)
    try {
      const res = await adminFetch<{ message: string }>('/api/admin/actions', {
        method: 'POST',
        body: JSON.stringify({ action, ...extra }),
      })
      toast.success(res.message)
      done?.()
      await load()
      onUsersChanged?.()
      if (dossier) await openDossier(dossier.user.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setActing(false)
    }
  }

  const statusBadge = (u: UserRow) => {
    if (u.accountStatus === 'banned') return <DarkBadge tone="danger">banned</DarkBadge>
    if (u.accountStatus === 'suspended') return <DarkBadge tone="rose">suspended</DarkBadge>
    if (u.flagged) return <DarkBadge tone="rose">flagged</DarkBadge>
    if (u.accountStatus === 'pending') return <DarkBadge tone="zinc">pending</DarkBadge>
    return <DarkBadge tone="emerald">active</DarkBadge>
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            value={q}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name or email…"
            className={`pl-8 h-9 ${inputDarkCls}`}
            aria-label="Search users"
          />
        </div>
        <Button
          variant="outline" size="sm"
          className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-zinc-100"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setStatus(f.key); void load({ status: f.key, page: 1 }) }}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-mono transition-colors ${
              status === f.key
                ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
                : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/25 hover:text-zinc-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto self-center font-mono text-[11px] text-zinc-500">{fmtNum(total)} users</span>
      </div>

      {/* Table */}
      <div className={panelCls + ' overflow-hidden'}>
        <ScrollArea className="max-h-[calc(100dvh-320px)]">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[2.2fr_0.9fr_1fr_1.2fr_1fr_0.9fr] gap-2 border-b border-white/10 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-500">
              <span>User</span><span>Provider</span><span>Status</span><span>Activity</span><span>Last login</span><span>Joined</span>
            </div>
            {loading && rows.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-14 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Scanning directory…
              </div>
            ) : rows.length === 0 ? (
              <div className="py-14 text-center text-sm text-zinc-500">No users match this filter.</div>
            ) : (
              rows.map((u) => (
                <button
                  key={u.id}
                  onClick={() => void openDossier(u.id)}
                  className="grid w-full grid-cols-[2.2fr_0.9fr_1fr_1.2fr_1fr_0.9fr] items-center gap-2 border-b border-white/5 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {u.avatar ? (
                      <img src={u.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-400/15 text-[11px] font-semibold text-rose-200">
                        {(u.name ?? u.email)[0]?.toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-zinc-200">{u.name ?? '—'}</span>
                      <span className="block truncate font-mono text-[11px] text-zinc-500">{u.email}</span>
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-zinc-400">{u.provider === 'google' ? 'Google' : 'Email'}</span>
                  <span>{statusBadge(u)}</span>
                  <span className="font-mono text-[11px] text-zinc-400">
                    {u._count.communityPosts}p · {u._count.comments}c · {u._count.cycles}cycles
                  </span>
                  <span className="font-mono text-[11px] text-zinc-400">{fmtRelative(u.lastLoginAt)}</span>
                  <span className="flex items-center justify-between font-mono text-[11px] text-zinc-500">
                    {fmtDate(u.createdAt)} <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                  </span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2">
          <span className="font-mono text-[11px] text-zinc-500">page {page} / {pages}</span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading}
              className="h-7 border-white/15 bg-transparent px-2.5 text-zinc-300 hover:bg-white/5"
              onClick={() => void load({ page: page - 1 })}>Prev</Button>
            <Button variant="outline" size="sm" disabled={page >= pages || loading}
              className="h-7 border-white/15 bg-transparent px-2.5 text-zinc-300 hover:bg-white/5"
              onClick={() => void load({ page: page + 1 })}>Next</Button>
          </div>
        </div>
      </div>

      {/* Dossier drawer */}
      <AnimatePresence>
        {dossierLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60">
            <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-[#12101c] px-4 py-3 text-sm text-zinc-300">
              <Loader2 className="h-4 w-4 animate-spin" /> Opening dossier…
            </div>
          </motion.div>
        )}
        {dossier && !dossierLoading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[210] bg-black/60"
            onClick={() => setDossier(null)}
          />
        )}
        {dossier && !dossierLoading && (
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-[215] flex w-full max-w-xl flex-col border-l border-white/12 bg-[#0e0c17]"
            role="dialog" aria-label="User dossier"
          >
            {/* Header */}
            <div className="flex items-start gap-3 border-b border-white/10 p-4">
              {dossier.user.avatar ? (
                <img src={dossier.user.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-400/15 text-base font-semibold text-rose-200">
                  {(dossier.user.name ?? dossier.user.email)[0]?.toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h2 className="truncate text-base font-semibold text-zinc-100">{dossier.user.name ?? 'Unnamed'}</h2>
                  {statusBadge(dossier.user as UserRow)}
                  {dossier.user.subscriptionTier === 'premium' && dossier.user.subscriptionStatus === 'active' && (
                    <DarkBadge tone="gold">premium</DarkBadge>
                  )}
                </div>
                <p className="truncate font-mono text-xs text-zinc-500">{dossier.user.email}</p>
                <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
                  joined {fmtDate(dossier.user.createdAt)} · last login {fmtRelative(dossier.user.lastLoginAt)}
                  {dossier.user.city || dossier.user.country ? ` · ${[dossier.user.city, dossier.user.country].filter(Boolean).join(', ')}` : ''}
                </p>
              </div>
              <button onClick={() => setDossier(null)} aria-label="Close dossier"
                className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <ScrollArea className="flex-1">
              <div className="space-y-4 p-4">
                {/* Aggregates */}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  <KpiCard label="posts" value={fmtNum(dossier.aggregates.posts ?? 0)} />
                  <KpiCard label="comments" value={fmtNum(dossier.aggregates.comments ?? 0)} />
                  <KpiCard label="cycles" value={fmtNum(dossier.aggregates.cycles ?? 0)} />
                  <KpiCard label="symptoms" value={fmtNum(dossier.aggregates.symptoms ?? 0)} />
                  <KpiCard label="moods" value={fmtNum(dossier.aggregates.moods ?? 0)} />
                  <KpiCard label="AI chats" value={fmtNum(dossier.aggregates.chats ?? 0)} />
                  <KpiCard label="devices" value={fmtNum(dossier.devices.length)} />
                  <KpiCard label="reports" value={fmtNum(dossier.aggregates.reportsMade ?? 0)} tone={(dossier.aggregates.reportsMade ?? 0) > 0 ? 'rose' : 'default'} />
                </div>

                {/* Profile + subscription facts */}
                <div className={panelCls + ' p-3.5 text-xs'}>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Profile & billing</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px] text-zinc-300">
                    <span>cycle: {dossier.user.cycleLength}d · period: {dossier.user.periodLength}d</span>
                    <span>provider: {dossier.user.provider}</span>
                    <span>onboarded: {dossier.user.onboardingComplete ? 'yes' : 'no'}</span>
                    <span>reminders: {dossier.user.remindersEnabled ? 'on' : 'off'}</span>
                    <span>
                      tier: {dossier.user.subscriptionTier ?? 'free'}
                      {dossier.user.subscriptionEnd && dossier.user.subscriptionStatus === 'active' && dossier.user.subscriptionTier !== 'free'
                        ? ` → ${fmtDate(dossier.user.subscriptionEnd)}` : ''}
                    </span>
                    <span>verified: {dossier.user.emailVerified ? 'yes' : 'no'}</span>
                    {dossier.user.lastPeriodStart && <span>last period: {fmtDate(dossier.user.lastPeriodStart)}</span>}
                    {dossier.user.banReason && <span className="col-span-2 text-red-400">ban reason: {dossier.user.banReason}</span>}
                  </div>
                </div>

                {/* Devices */}
                <div className={panelCls + ' p-3.5'}>
                  <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                    <Smartphone className="h-3 w-3" /> Device sessions
                  </p>
                  {dossier.devices.length === 0 ? (
                    <p className="text-xs text-zinc-600">No device sessions recorded.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {dossier.devices.map((d) => (
                        <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                          <div className="min-w-0">
                            <p className="truncate text-[11px] text-zinc-300">{d.deviceInfo ?? 'Unknown device'}</p>
                            <p className="font-mono text-[10px] text-zinc-600">{d.ipAddress ?? 'ip —'} · {fmtRelative(d.createdAt)}</p>
                          </div>
                          {d.revoked ? <DarkBadge tone="zinc">revoked</DarkBadge> : <DarkBadge tone="emerald">live</DarkBadge>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent activity */}
                <div className={panelCls + ' p-3.5'}>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Recent activity</p>
                  {dossier.recentPosts.length === 0 && dossier.recentComments.length === 0 && dossier.recentCycles.length === 0 && (
                    <p className="text-xs text-zinc-600">No community or cycle activity yet.</p>
                  )}
                  <div className="space-y-1.5">
                    {dossier.recentPosts.map((p) => (
                      <div key={p.id} className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                        <p className="truncate text-[11px] text-zinc-300">📝 {p.title}</p>
                        <p className="font-mono text-[10px] text-zinc-600">{p.category} · ♥ {p.likes} · {fmtRelative(p.createdAt)}{p.hidden ? ' · hidden' : ''}{p.reportedCount > 0 ? ` · ${p.reportedCount} reports` : ''}</p>
                      </div>
                    ))}
                    {dossier.recentComments.map((c) => (
                      <div key={c.id} className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                        <p className="truncate text-[11px] text-zinc-400">💬 {c.content}</p>
                        <p className="font-mono text-[10px] text-zinc-600">on “{c.post?.title ?? 'post'}” · {fmtRelative(c.createdAt)}</p>
                      </div>
                    ))}
                    {dossier.recentCycles.map((c) => (
                      <div key={c.id} className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                        <p className="text-[11px] text-zinc-400"><HeartPulse className="mr-1 inline h-3 w-3 text-rose-300" />cycle start {fmtDate(c.startDate)}{c.endDate ? ` → ${fmtDate(c.endDate)}` : ' (ongoing)'}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Operator notes */}
                <div className={panelCls + ' p-3.5'}>
                  <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                    <StickyNote className="h-3 w-3" /> Operator notes
                  </p>
                  {dossier.user.notes ? (
                    <pre className="whitespace-pre-wrap rounded-lg bg-white/[0.03] p-2.5 font-mono text-[11px] leading-relaxed text-zinc-400">{dossier.user.notes}</pre>
                  ) : (
                    <p className="text-xs text-zinc-600">No notes on this account.</p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add an operator note…"
                      className={`h-8 text-xs ${inputDarkCls}`}
                    />
                    <Button size="sm" disabled={acting || !noteText.trim()}
                      className="h-8 bg-amber-400 px-2.5 text-[#0a0810] hover:bg-amber-300"
                      onClick={() => void runAction('add_note', { userId: dossier.user.id, reason: noteText.trim() }, () => setNoteText(''))}>
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Action bar */}
            <div className="border-t border-white/10 bg-[#0e0c17] p-3">
              <div className="flex flex-wrap gap-1.5">
                {dossier.user.accountStatus === 'active' ? (
                  <>
                    <Button size="sm" variant="outline" disabled={acting}
                      className="h-7 border-rose-400/30 bg-rose-400/10 text-xs text-rose-300 hover:bg-rose-400/20"
                      onClick={() => void runAction('suspend_user', { userId: dossier.user.id, reason: 'Suspended from basement console' })}>
                      <ShieldOff className="h-3 w-3" /> Suspend
                    </Button>
                    <Button size="sm" variant="outline" disabled={acting}
                      className="h-7 border-red-500/30 bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20"
                      onClick={() => void runAction('ban_user', { userId: dossier.user.id, reason: 'Banned from basement console' })}>
                      <Ban className="h-3 w-3" /> Ban
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" disabled={acting}
                    className="h-7 border-emerald-400/30 bg-emerald-400/10 text-xs text-emerald-300 hover:bg-emerald-400/20"
                    onClick={() => void runAction('activate_user', { userId: dossier.user.id })}>
                    <CheckCircle2 className="h-3 w-3" /> Re-activate
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={acting}
                  className="h-7 border-white/15 bg-transparent text-xs text-zinc-300 hover:bg-white/5"
                  onClick={() => void runAction(dossier.user.flagged ? 'unflag_user' : 'flag_user', { userId: dossier.user.id })}>
                  <Flag className="h-3 w-3" /> {dossier.user.flagged ? 'Unflag' : 'Flag'}
                </Button>
                {dossier.user.subscriptionTier === 'premium' && dossier.user.subscriptionStatus === 'active' ? (
                  <Button size="sm" variant="outline" disabled={acting}
                    className="h-7 border-white/15 bg-transparent text-xs text-zinc-300 hover:bg-white/5"
                    onClick={() => void runAction('revoke_premium', { userId: dossier.user.id })}>
                    <Sparkles className="h-3 w-3" /> Revoke premium
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" disabled={acting}
                      className="h-7 border-amber-400/30 bg-amber-400/10 text-xs text-amber-300 hover:bg-amber-400/20"
                      onClick={() => void runAction('grant_premium', { userId: dossier.user.id, plan: 'monthly' })}>
                      <Sparkles className="h-3 w-3" /> Premium ·mo
                    </Button>
                    <Button size="sm" variant="outline" disabled={acting}
                      className="h-7 border-amber-400/30 bg-amber-400/10 text-xs text-amber-300 hover:bg-amber-400/20"
                      onClick={() => void runAction('grant_premium', { userId: dossier.user.id, plan: 'yearly' })}>
                      Premium ·yr
                    </Button>
                  </>
                )}
                <Button size="sm" variant="outline" disabled={acting}
                  className="h-7 border-white/15 bg-transparent text-xs text-zinc-300 hover:bg-white/5"
                  onClick={() => void runAction('force_logout', { userId: dossier.user.id })}>
                  <LogOut className="h-3 w-3" /> Force logout
                </Button>
                <Button size="sm" variant="outline" disabled={acting}
                  className="ml-auto h-7 border-red-500/40 bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20"
                  onClick={() => setConfirmDelete(dossier.user as UserRow)}>
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="border-white/15 bg-[#14111f] text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this user?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This wipes <span className="font-mono text-zinc-200">{confirmDelete?.email}</span> and every linked record —
              cycles, symptoms, posts, comments, devices. The action is audit-logged and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-500"
              disabled={acting}
              onClick={() => {
                const target = confirmDelete
                setConfirmDelete(null)
                if (target) void runAction('delete_user', { userId: target.id }, () => setDossier(null))
              }}
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
