'use client'

// ─── Basement · Ops tabs (Moderation / Audit / Broadcast) ────────────────────
// Compact re-use of the existing moderation API, the audit-trail viewer, and
// the platform-wide broadcast composer. All calls SUPER_ADMIN bearer gated.

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2, EyeOff, Loader2, Megaphone, Radio, RefreshCw, ScrollText, Trash2, Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DarkBadge, fmtDateTime, fmtNum, fmtRelative, inputDarkCls, panelCls } from './basement-shared'
import { toast } from 'sonner'

type AdminFetch = <T>(url: string, init?: RequestInit) => Promise<T>

// ═══ Moderation ══════════════════════════════════════════════════════════════
interface ModPost {
  id: string; title: string; content: string; category: string; likes: number
  reportedCount: number; hidden: boolean; createdAt: string
  author: { name: string | null; email: string; avatar: string | null }
  commentCount: number
  reports: { reason: string | null; createdAt: string; reporter: string }[]
}
interface ModComment {
  id: string; content: string; reportedCount: number; hidden: boolean; createdAt: string
  author: { name: string | null; email: string }
  post: { id: string; title: string } | null
  reports: { reason: string | null; createdAt: string; reporter: string }[]
}

export function BasementModeration({ adminFetch }: { adminFetch: AdminFetch }) {
  const [posts, setPosts] = useState<ModPost[]>([])
  const [comments, setComments] = useState<ModComment[]>([])
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminFetch<{ queue: ModPost[]; commentQueue: ModComment[]; stats: Record<string, number> }>('/api/admin/moderation')
      setPosts(data.queue)
      setComments(data.commentQueue)
      setStats(data.stats)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load queue')
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => { void load() }, [load])

  const act = async (targetType: 'post' | 'comment', id: string, action: string) => {
    setActing(true)
    try {
      const res = await adminFetch<{ message: string }>('/api/admin/moderation', {
        method: 'PATCH',
        body: JSON.stringify({ targetType, id, action }),
      })
      toast.success(res.message)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {stats && (
          <>
            <DarkBadge tone="gold">{fmtNum(stats.queueSize)} in queue</DarkBadge>
            <DarkBadge>{fmtNum(stats.totalPosts)} posts</DarkBadge>
            <DarkBadge>{fmtNum(stats.hiddenCount)} hidden</DarkBadge>
            <DarkBadge>{fmtNum(stats.hiddenComments)} hidden comments</DarkBadge>
          </>
        )}
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}
          className="ml-auto h-8 border-white/15 bg-transparent text-zinc-300 hover:bg-white/5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <ScrollArea className="max-h-[calc(100dvh-300px)]">
        {loading && posts.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading queue…
          </div>
        ) : posts.length === 0 && comments.length === 0 ? (
          <div className={panelCls + ' flex flex-col items-center gap-2 py-14 text-center'}>
            <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            <p className="text-sm text-zinc-300">Queue is clear</p>
            <p className="text-xs text-zinc-500">No reported or hidden content right now.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {posts.map((p) => (
              <div key={p.id} className={panelCls + ' p-3.5'}>
                <div className="flex flex-wrap items-center gap-2">
                  <DarkBadge tone="rose">{p.reportedCount} reports</DarkBadge>
                  {p.hidden && <DarkBadge tone="danger">hidden</DarkBadge>}
                  <DarkBadge>{p.category}</DarkBadge>
                  <span className="ml-auto font-mono text-[10px] text-zinc-600">{fmtRelative(p.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-zinc-200">{p.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{p.content}</p>
                <p className="mt-1 font-mono text-[10px] text-zinc-600">by {p.author.name ?? p.author.email} · ♥ {p.likes} · {p.commentCount} comments</p>
                {p.reports.length > 0 && (
                  <p className="mt-1 truncate font-mono text-[10px] text-rose-300/80">
                    reasons: {p.reports.map((r) => `${r.reason ?? 'unspecified'} (${r.reporter})`).join(' · ')}
                  </p>
                )}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Button size="sm" disabled={acting} className="h-7 bg-emerald-500/90 text-xs text-white hover:bg-emerald-500"
                    onClick={() => void act('post', p.id, 'restore')}>
                    <Undo2 className="h-3 w-3" /> Restore
                  </Button>
                  <Button size="sm" variant="outline" disabled={acting}
                    className="h-7 border-white/15 bg-transparent text-xs text-zinc-300 hover:bg-white/5"
                    onClick={() => void act('post', p.id, 'dismiss')}>
                    <EyeOff className="h-3 w-3" /> Dismiss (keep hidden)
                  </Button>
                  <Button size="sm" variant="outline" disabled={acting}
                    className="h-7 border-red-500/30 bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20"
                    onClick={() => void act('post', p.id, 'delete')}>
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                </div>
              </div>
            ))}
            {comments.map((c) => (
              <div key={c.id} className={panelCls + ' p-3.5'}>
                <div className="flex flex-wrap items-center gap-2">
                  <DarkBadge tone="rose">{c.reportedCount} reports</DarkBadge>
                  {c.hidden && <DarkBadge tone="danger">hidden</DarkBadge>}
                  <DarkBadge>comment</DarkBadge>
                  <span className="ml-auto font-mono text-[10px] text-zinc-600">{fmtRelative(c.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-xs text-zinc-300">“{c.content}”</p>
                <p className="mt-1 font-mono text-[10px] text-zinc-600">by {c.author.name ?? c.author.email} · on “{c.post?.title ?? 'deleted post'}”</p>
                <div className="mt-2.5 flex gap-1.5">
                  <Button size="sm" disabled={acting} className="h-7 bg-emerald-500/90 text-xs text-white hover:bg-emerald-500"
                    onClick={() => void act('comment', c.id, 'restore')}>
                    <Undo2 className="h-3 w-3" /> Restore
                  </Button>
                  <Button size="sm" variant="outline" disabled={acting}
                    className="h-7 border-red-500/30 bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20"
                    onClick={() => void act('comment', c.id, 'delete')}>
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// ═══ Audit trail ═════════════════════════════════════════════════════════════
interface AuditEntry {
  id: string; adminName: string | null; action: string; targetType: string | null
  targetId: string | null; targetLabel: string | null; details: string | null
  ipAddress: string | null; createdAt: string
}

export function BasementAudit({ adminFetch }: { adminFetch: AdminFetch }) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (query?: string) => {
    setLoading(true)
    try {
      const data = await adminFetch<{ entries: AuditEntry[]; total: number }>(`/api/admin/audit?take=100${query ? `&q=${encodeURIComponent(query)}` : ''}`)
      setEntries(data.entries)
      setTotal(data.total)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load audit trail')
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => { void load() }, [load])

  const toneFor = (action: string) => {
    if (action.includes('delete') || action.includes('ban')) return 'danger'
    if (action.includes('suspend') || action.includes('dismiss')) return 'rose'
    if (action.includes('restore') || action.includes('activate')) return 'emerald'
    if (action.includes('premium') || action.includes('broadcast')) return 'gold'
    return 'zinc'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load(q)}
          placeholder="Filter audit trail (action, target, operator)…"
          className={`h-9 flex-1 ${inputDarkCls}`}
          aria-label="Filter audit trail"
        />
        <Button size="sm" onClick={() => void load(q)} disabled={loading}
          className="h-9 bg-amber-400 text-[#0a0810] hover:bg-amber-300">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScrollText className="h-3.5 w-3.5" />} Search
        </Button>
        <span className="font-mono text-[11px] text-zinc-500">{fmtNum(total)} total</span>
      </div>

      <ScrollArea className="max-h-[calc(100dvh-300px)]">
        <div className={panelCls + ' divide-y divide-white/5'}>
          {loading && entries.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the trail…
            </p>
          ) : entries.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">No audit entries found.</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="px-4 py-2.5 transition-colors hover:bg-white/[0.03]">
                <div className="flex flex-wrap items-center gap-2">
                  <DarkBadge tone={toneFor(e.action)}>{e.action}</DarkBadge>
                  <span className="font-mono text-[11px] text-zinc-400">{e.adminName ?? 'system'}</span>
                  <span className="ml-auto font-mono text-[10px] text-zinc-600">{fmtDateTime(e.createdAt)}</span>
                </div>
                <p className="mt-1 truncate text-xs text-zinc-300">{e.targetLabel ?? e.targetType ?? '—'}</p>
                {e.details && <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-600">{e.details}</p>}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ═══ Broadcast ═══════════════════════════════════════════════════════════════
export function BasementBroadcast({ adminFetch, estimatedRecipients }: { adminFetch: AdminFetch; estimatedRecipients: number }) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState('admin')
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const send = async () => {
    setConfirmOpen(false)
    setSending(true)
    try {
      const res = await adminFetch<{ message: string }>('/api/admin/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'broadcast', title, message, type }),
      })
      toast.success(res.message)
      setTitle('')
      setMessage('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Broadcast failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-3.5">
      <div className={panelCls + ' flex items-center gap-3 p-4'}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10">
          <Radio className="h-5 w-5 text-amber-300" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-200">Platform broadcast</p>
          <p className="text-xs text-zinc-500">Lands in every non-banned user's notification feed instantly.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="font-mono text-[10px] uppercase tracking-wider text-zinc-500" htmlFor="bc-title">Title</label>
        <Input id="bc-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
          placeholder="e.g. Scheduled maintenance tonight" className={inputDarkCls} />
      </div>
      <div className="space-y-1.5">
        <label className="font-mono text-[10px] uppercase tracking-wider text-zinc-500" htmlFor="bc-type">Type</label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className={`w-full ${inputDarkCls}`} aria-label="Broadcast type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
            <SelectItem value="admin">admin</SelectItem>
            <SelectItem value="announcement">announcement</SelectItem>
            <SelectItem value="health">health</SelectItem>
            <SelectItem value="feature">feature</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="font-mono text-[10px] uppercase tracking-wider text-zinc-500" htmlFor="bc-msg">Message</label>
        <Textarea id="bc-msg" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000}
          rows={5} placeholder="What should every user know?" className={inputDarkCls} />
      </div>

      <Button
        onClick={() => setConfirmOpen(true)}
        disabled={sending || !title.trim() || !message.trim()}
        className="w-full bg-amber-400 font-semibold text-[#0a0810] hover:bg-amber-300"
      >
        {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Transmitting…</> : <><Megaphone className="h-4 w-4" /> Send broadcast</>}
      </Button>
      <p className="text-center font-mono text-[10px] text-zinc-600">≈{fmtNum(estimatedRecipients)} recipients · action is audit-logged</p>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border-white/15 bg-[#14111f] text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Send to ≈{fmtNum(estimatedRecipients)} users?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              “{title}” will appear in every active user's notifications. This cannot be unsent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-amber-400 text-[#0a0810] hover:bg-amber-300" onClick={send}>Send now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
