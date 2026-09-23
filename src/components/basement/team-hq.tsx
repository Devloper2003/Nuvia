'use client'

// ─── Basement · Team HQ ──────────────────────────────────────────────────────
// Internal org command: invite & manage operators, shape departments, run the
// workflow board (backlog → in_progress → review → done). SUPER_ADMIN only.
// Includes HQ stats strip, live-session pulses, roster search/filters, member
// dossier drawer, drag & drop board with due dates and an overdue radar.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlarmClock, Building2, Check, ChevronRight, ClipboardList, Copy, Flame, KeyRound,
  Loader2, Pencil, Plus, Radio, Search, Trash2, UserPlus, Users2, X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  AdminFetch, ConfirmButton, DarkBadge, KpiCard, SectionTitle, fmtDate,
  fmtRelative, inputDarkCls, panelCls,
} from './basement-shared'

type Member = {
  id: string; email: string; name: string; role: string; department: string | null
  active: boolean; lastLoginAt: string | null; createdAt: string
  liveSessions: number; openTasks: number; auditActions: number
}

type DeptMemberLite = { id: string; name: string; role: string; active: boolean }

type Department = {
  id: string; name: string; key: string; description: string | null; color: string
  createdAt: string; taskCount: number; openTaskCount: number; memberCount: number
  members: DeptMemberLite[]
}

type Task = {
  id: string; title: string; description: string | null; status: string; priority: string
  dueDate: string | null; departmentId: string | null; createdByName: string | null
  department: { name: string; key: string; color: string } | null
  assignee: { id: string; name: string; email: string } | null
}

type AuditEntry = {
  id: string; action: string; details: string | null; targetLabel: string | null
  targetType: string | null; createdAt: string
}

type Creds = { email: string; password: string }

const STATUS_COLS = [
  { key: 'backlog', label: 'Backlog', dot: 'bg-zinc-500' },
  { key: 'in_progress', label: 'In progress', dot: 'bg-amber-400' },
  { key: 'review', label: 'Review', dot: 'bg-violet-400' },
  { key: 'done', label: 'Done', dot: 'bg-emerald-400' },
] as const

const ROLES = ['admin', 'moderator'] // super_admin is minted via DB/API only — founder-controlled

const PRIO_TONE: Record<string, string> = { urgent: 'danger', high: 'rose', medium: 'gold', low: 'zinc' }
const PRIO_STRIPE: Record<string, string> = {
  urgent: 'bg-red-400', high: 'bg-rose-400', medium: 'bg-amber-400', low: 'bg-zinc-600',
}

const DEPT_COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#e879f9']

const ROLE_STYLE: Record<string, { chip: string; avatar: string }> = {
  super_admin: { chip: 'gold', avatar: 'bg-amber-400/15 text-amber-200 border border-amber-400/30' },
  admin: { chip: 'rose', avatar: 'bg-rose-400/15 text-rose-200 border border-rose-400/30' },
  moderator: { chip: 'violet', avatar: 'bg-violet-400/15 text-violet-200 border border-violet-400/30' },
}

const isOverdue = (t: Task) =>
  !!t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date(new Date().toDateString())

// Compact dark modal shell used by dept/task editors + member drawer backdrop.
function DarkModal({
  open, onClose, title, children, wide,
}: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18 }}
            role="dialog" aria-modal="true" aria-label={title}
            className={cn(panelCls, 'relative max-h-[85vh] w-full overflow-y-auto bg-[#100d19] p-4 shadow-2xl',
              wide ? 'max-w-2xl' : 'max-w-lg')}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-400">{title}</p>
              <button onClick={onClose} aria-label="Close dialog"
                className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Role-tinted initial avatar with an optional live-session pulse.
function OperatorAvatar({ name, role, live, size = 'md' }: { name: string; role: string; live?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'h-11 w-11 text-base' : size === 'sm' ? 'h-5 w-5 text-[8px]' : 'h-8 w-8 text-xs'
  return (
    <span className="relative inline-flex shrink-0">
      <span className={cn('flex items-center justify-center rounded-full font-semibold', sz, ROLE_STYLE[role]?.avatar ?? ROLE_STYLE.moderator.avatar)}>
        {(name ?? '?')[0]?.toUpperCase()}
      </span>
      {live ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0a0810]">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        </span>
      ) : null}
    </span>
  )
}

// Department chip with its color dot.
function DeptChip({ name, color }: { name: string; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-mono text-zinc-300">
      <i className="h-1.5 w-1.5 rounded-full" style={{ background: color ?? '#a1a1aa' }} />
      {name}
    </span>
  )
}

// One-time credentials handoff card — per-field copy, shown once.
function CredsCard({ creds, onClose }: { creds: Creds; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1600)
    } catch { toast.error('Clipboard blocked — copy manually') }
  }
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className="relative mt-2.5 rounded-lg border border-amber-400/30 bg-amber-400/[0.07] p-3">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">
        <KeyRound className="h-3 w-3" /> One-time credentials — copy now, shown only once
      </p>
      <div className="mt-2 space-y-1.5">
        {([['email', creds.email], ['password', creds.password]] as const).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2 rounded-md bg-black/30 px-2.5 py-1.5">
            <span className="w-16 font-mono text-[9px] uppercase tracking-wider text-zinc-500">{key}</span>
            <span className="min-w-0 flex-1 select-all truncate font-mono text-xs text-zinc-100">{val}</span>
            <button onClick={() => void copy(val, key)} aria-label={`Copy ${key}`}
              className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-300 transition-colors hover:bg-amber-400/20">
              {copied === key ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button onClick={() => void copy(`${creds.email} / ${creds.password}`, 'all')}
          className="rounded-md bg-amber-400 px-2.5 py-1 text-[11px] font-semibold text-[#0a0810] transition-colors hover:bg-amber-300">
          {copied === 'all' ? 'Copied ✓' : 'Copy all'}
        </button>
        <button onClick={onClose} className="text-[11px] text-zinc-500 underline underline-offset-2 hover:text-zinc-300">
          Done — hide
        </button>
      </div>
    </motion.div>
  )
}

// ═══ Parent: shared data + HQ stats strip + view switch ══════════════════════
export function BasementTeam({ adminFetch }: { adminFetch: AdminFetch }) {
  const [view, setView] = useState<'members' | 'org' | 'board'>('members')
  const [members, setMembers] = useState<Member[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [t, d, m] = await Promise.all([
        adminFetch<{ members: Member[] }>('/api/admin/team'),
        adminFetch<{ departments: Department[] }>('/api/admin/departments'),
        adminFetch<{ tasks: Task[] }>('/api/admin/tasks'),
      ])
      setMembers(Array.isArray(t.members) ? t.members : [])
      setDepartments(Array.isArray(d.departments) ? d.departments : [])
      setTasks(Array.isArray(m.tasks) ? m.tasks : [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load Team HQ')
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => { void reload() }, [reload])

  const stats = useMemo(() => ({
    members: members.length,
    online: members.filter((m) => m.liveSessions > 0).length,
    open: tasks.filter((t) => t.status !== 'done').length,
    urgent: tasks.filter((t) => t.priority === 'urgent' && t.status !== 'done').length,
    overdue: tasks.filter((t) => isOverdue(t)).length,
  }), [members, tasks])

  const views = [
    { v: 'members' as const, label: 'Members', count: members.length },
    { v: 'org' as const, label: 'Departments', count: departments.length },
    { v: 'board' as const, label: 'Workflow board', count: stats.open },
  ]

  return (
    <div className="space-y-3.5">
      {/* HQ stats strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Operators" value={stats.members} icon={<Users2 className="h-3.5 w-3.5" />} sub="team roster" />
        <KpiCard label="Live now" value={stats.online} tone="emerald" icon={<Radio className="h-3.5 w-3.5" />} sub="active sessions" />
        <KpiCard label="Open tasks" value={stats.open} tone="gold" icon={<ClipboardList className="h-3.5 w-3.5" />} sub="on the board" />
        <KpiCard label="Urgent" value={stats.urgent} tone="rose" icon={<Flame className="h-3.5 w-3.5" />} sub="priority flagged" />
        <KpiCard label="Overdue" value={stats.overdue} tone="danger" icon={<AlarmClock className="h-3.5 w-3.5" />} sub="past due date" />
      </div>

      {/* view switch */}
      <div className="flex items-center gap-1.5">
        {views.map(({ v, label, count }) => (
          <button key={v} onClick={() => setView(v)}
            className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              view === v
                ? 'border border-amber-400/30 bg-amber-400/10 text-amber-300'
                : 'text-zinc-500 hover:text-zinc-300')}>
            {label}
            <span className={cn('rounded-full px-1.5 py-px font-mono text-[9px]',
              view === v ? 'bg-amber-400/20 text-amber-200' : 'bg-white/[0.06] text-zinc-500')}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {loading && members.length === 0 && departments.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Assembling the HQ…
        </p>
      ) : (
        <>
          {view === 'members' && <MembersDesk adminFetch={adminFetch} members={members} departments={departments} reload={reload} />}
          {view === 'org' && <OrgDesk adminFetch={adminFetch} departments={departments} reload={reload} members={members} />}
          {view === 'board' && (
            <BoardDesk adminFetch={adminFetch} tasks={tasks} departments={departments} members={members} reload={reload}
              onOptimisticMove={(id, status) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)))} />
          )}
        </>
      )}
    </div>
  )
}

// ═══ Members ═════════════════════════════════════════════════════════════════
function MembersDesk({
  adminFetch, members, departments, reload,
}: {
  adminFetch: AdminFetch; members: Member[]; departments: Department[]; reload: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('moderator')
  const [deptKey, setDeptKey] = useState('none')
  const [customPwd, setCustomPwd] = useState(false)
  const [password, setPassword] = useState('')
  const [creds, setCreds] = useState<Creds | null>(null)
  const [drawer, setDrawer] = useState<Member | null>(null)

  // roster filters
  const [q, setQ] = useState('')
  const [statusF, setStatusF] = useState<'all' | 'active' | 'offline'>('all')
  const [roleF, setRoleF] = useState('all')

  const filtered = useMemo(() => members.filter((m) =>
    (statusF === 'all' || (statusF === 'active' ? m.active : !m.active)) &&
    (roleF === 'all' || m.role === roleF) &&
    (!q.trim() || `${m.name} ${m.email} ${m.department ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  ), [members, q, statusF, roleF])

  const deptName = (key: string | null) => key ? departments.find((d) => d.key === key) ?? null : null

  const invite = async () => {
    if (!email.trim() || !name.trim()) { toast.error('Name and email are required.'); return }
    if (customPwd && password.trim().length < 8) { toast.error('Custom password needs at least 8 characters.'); return }
    setBusy(true)
    try {
      const data = await adminFetch<{ credentials: Creds }>('/api/admin/team', {
        method: 'POST',
        body: JSON.stringify({
          email, name, role,
          department: deptKey === 'none' ? undefined : deptKey,
          password: customPwd && password.trim() ? password.trim() : undefined,
        }),
      })
      setCreds(data.credentials)
      toast.success(`${name} joined the team`)
      setEmail(''); setName(''); setPassword(''); setCustomPwd(false); setDeptKey('none')
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invite failed')
    } finally {
      setBusy(false)
    }
  }

  const patch = async (id: string, action: string, value?: string) => {
    try {
      const res = await adminFetch<{ message?: string; credentials?: Creds }>('/api/admin/team', {
        method: 'PATCH',
        body: JSON.stringify({ id, action, value }),
      })
      if (res.credentials) setCreds(res.credentials)
      else toast.success(res.message ?? 'Updated')
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  return (
    <div className="space-y-3.5">
      {/* invite */}
      <div className={panelCls + ' p-4'}>
        <SectionTitle icon={<UserPlus className="h-3 w-3" />}>Invite a team member</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputDarkCls} />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="work email" type="email" className={inputDarkCls} />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className={`w-full ${inputDarkCls}`} aria-label="Role"><SelectValue /></SelectTrigger>
            <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
              {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={deptKey} onValueChange={setDeptKey}>
            <SelectTrigger className={`w-full ${inputDarkCls}`} aria-label="Department"><SelectValue /></SelectTrigger>
            <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
              <SelectItem value="none">no department</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.key}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => void invite()} disabled={busy}
            className="h-9 bg-amber-400 font-semibold text-[#0a0810] hover:bg-amber-300">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5" /> Invite</>}
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button onClick={() => setCustomPwd((v) => !v)}
            className="text-[10px] text-zinc-500 underline underline-offset-2 transition-colors hover:text-zinc-300">
            {customPwd ? 'use auto-generated password' : 'set password manually'}
          </button>
          {customPwd && (
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="text"
              placeholder="min 8 characters" className={`h-7 max-w-56 text-xs ${inputDarkCls}`} />
          )}
        </div>
        {creds && <CredsCard creds={creds} onClose={() => setCreds(null)} />}
      </div>

      {/* roster */}
      <div className={panelCls + ' p-4'}>
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            Team roster <span className="text-zinc-600">({filtered.length}/{members.length})</span>
          </span>
          <div className="relative ml-auto w-full sm:w-52">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-600" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search name, email, dept…"
              className={`h-7 pl-7 text-xs ${inputDarkCls}`} />
          </div>
          <div className="flex gap-1">
            {([['all', 'all'], ['active', 'active'], ['offline', 'offline']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setStatusF(v)}
                className={cn('rounded-md px-2 py-1 font-mono text-[10px] transition-colors',
                  statusF === v ? 'bg-amber-400/15 text-amber-300' : 'bg-white/[0.05] text-zinc-500 hover:text-zinc-300')}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {['all', 'super_admin', 'admin', 'moderator'].map((r) => (
              <button key={r} onClick={() => setRoleF(r)}
                className={cn('rounded-md px-2 py-1 font-mono text-[10px] transition-colors',
                  roleF === r ? 'bg-amber-400/15 text-amber-300' : 'bg-white/[0.05] text-zinc-500 hover:text-zinc-300')}>
                {r === 'all' ? 'all roles' : r}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-600">
            {members.length === 0 ? 'No operators yet — invite your first team member above.' : 'No members match these filters.'}
          </p>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((m) => {
              const dept = deptName(m.department)
              return (
                <motion.div key={m.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  onClick={() => setDrawer(m)}
                  className="cursor-pointer rounded-lg bg-white/[0.03] px-3 py-2.5 transition-colors hover:bg-white/[0.055]">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <OperatorAvatar name={m.name} role={m.role} live={m.liveSessions > 0} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-zinc-100">{m.name}</span>
                        {m.role === 'super_admin' && <span className="text-[10px] font-semibold text-amber-300">★ founder-level</span>}
                        {dept && <DeptChip name={dept.name} color={dept.color} />}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-zinc-600">{m.email}</span>
                    </span>
                    <DarkBadge tone={ROLE_STYLE[m.role]?.chip ?? 'zinc'}>{m.role}</DarkBadge>
                    <DarkBadge tone={m.active ? 'emerald' : 'danger'}>{m.active ? 'active' : 'off'}</DarkBadge>
                    <span className="hidden font-mono text-[10px] text-zinc-500 md:inline">
                      {m.liveSessions} live · {m.openTasks} tasks · {m.auditActions} actions · last in {fmtRelative(m.lastLoginAt)}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                  </div>
                  {m.role !== 'super_admin' && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => void patch(m.id, m.active ? 'deactivate' : 'activate')}
                        className={cn('h-6.5 px-2 py-0 text-[11px]',
                          m.active ? 'border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20'
                            : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20')}>
                        {m.active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Select value={m.role} onValueChange={(v) => void patch(m.id, 'set_role', v)}>
                        <SelectTrigger className={`h-6.5 w-[104px] px-2 py-0 text-[11px] ${inputDarkCls}`} aria-label="Change role"><SelectValue /></SelectTrigger>
                        <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
                          {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={m.department ?? 'none'} onValueChange={(v) => void patch(m.id, 'set_department', v === 'none' ? '' : v)}>
                        <SelectTrigger className={`h-6.5 w-[130px] px-2 py-0 text-[11px] ${inputDarkCls}`} aria-label="Change department"><SelectValue /></SelectTrigger>
                        <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
                          <SelectItem value="none">no dept</SelectItem>
                          {departments.map((d) => <SelectItem key={d.id} value={d.key}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <ConfirmButton onConfirm={() => patch(m.id, 'reset_password')} tone="gold" className="h-6.5 py-0">
                        Reset password
                      </ConfirmButton>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* dossier drawer */}
      <AnimatePresence>
        {drawer && (
          <MemberDrawer key={drawer.id} adminFetch={adminFetch} member={drawer} departments={departments}
            onClose={() => setDrawer(null)} onChanged={reload}
            onPatched={(c) => { if (c) setCreds(c) }} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ═══ Member dossier drawer ═══════════════════════════════════════════════════
function MemberDrawer({
  adminFetch, member, departments, onClose, onChanged, onPatched,
}: {
  adminFetch: AdminFetch; member: Member; departments: Department[]
  onClose: () => void; onChanged: () => Promise<void>; onPatched: (c?: Creds) => void
}) {
  const [detail, setDetail] = useState<{ member: Member; tasks: Task[]; audit: AuditEntry[]; liveSessions: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(member.name)
  const [creds, setCreds] = useState<Creds | null>(null)
  const isSelf = member.role === 'super_admin'

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setDetail(await adminFetch<{ member: Member; tasks: Task[]; audit: AuditEntry[]; liveSessions: number }>(
        `/api/admin/team?detail=${member.id}`))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load dossier')
    } finally {
      setLoading(false)
    }
  }, [adminFetch, member.id])

  useEffect(() => { void refresh() }, [refresh])

  const act = async (action: string, value?: string) => {
    try {
      const res = await adminFetch<{ message?: string; credentials?: Creds }>('/api/admin/team', {
        method: 'PATCH',
        body: JSON.stringify({ id: member.id, action, value }),
      })
      if (res.credentials) {
        setCreds(res.credentials)
        toast.success('New password issued — live sessions revoked')
      } else {
        toast.success(res.message ?? 'Updated')
      }
      onPatched(res.credentials)
      await Promise.all([refresh(), onChanged()])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const rename = async () => {
    if (!newName.trim()) { toast.error('Name is required.'); return }
    await act('rename', newName.trim())
    setRenaming(false)
  }

  const removeMember = async () => {
    try {
      const res = await adminFetch<{ message: string }>(`/api/admin/team?id=${member.id}`, { method: 'DELETE' })
      toast.success(res.message)
      await onChanged()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed')
    }
  }

  const drawerTasks = Array.isArray(detail?.tasks) ? detail.tasks : []
  const drawerAudit = Array.isArray(detail?.audit) ? detail.audit : []
  const m = detail?.member ?? member
  const dept = m.department ? departments.find((d) => d.key === m.department) ?? null : null

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[65] flex justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <motion.aside
        initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        role="dialog" aria-modal="true" aria-label={`Dossier — ${m.name}`}
        className={cn(panelCls, 'relative flex max-h-full w-full max-w-md flex-col overflow-y-auto rounded-none bg-[#100d19] p-4 sm:max-w-lg')}>
        {/* header */}
        <div className="flex items-start gap-3">
          <OperatorAvatar name={m.name} role={m.role} live={(detail?.liveSessions ?? member.liveSessions) > 0} size="lg" />
          <div className="min-w-0 flex-1">
            {renaming ? (
              <div className="flex items-center gap-1.5">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} className={`h-7 text-xs ${inputDarkCls}`}
                  onKeyDown={(e) => e.key === 'Enter' && void rename()} autoFocus />
                <Button size="sm" onClick={() => void rename()} className="h-7 bg-amber-400 px-2 text-[11px] font-semibold text-[#0a0810] hover:bg-amber-300">Save</Button>
                <Button size="sm" variant="outline" onClick={() => { setRenaming(false); setNewName(m.name) }} className="h-7 px-2 text-[11px]">✕</Button>
              </div>
            ) : (
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold text-zinc-100">{m.name}</span>
                {m.role === 'super_admin' && <span className="text-[10px] font-semibold text-amber-300">★ founder-level</span>}
                <button onClick={() => setRenaming(true)} aria-label="Rename member"
                  className="rounded p-0.5 text-zinc-600 transition-colors hover:text-amber-300">
                  <Pencil className="h-3 w-3" />
                </button>
              </p>
            )}
            <p className="truncate font-mono text-[11px] text-zinc-500">{m.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <DarkBadge tone={ROLE_STYLE[m.role]?.chip ?? 'zinc'}>{m.role}</DarkBadge>
              <DarkBadge tone={m.active ? 'emerald' : 'danger'}>{m.active ? 'active' : 'off'}</DarkBadge>
              {dept && <DeptChip name={dept.name} color={dept.color} />}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close dossier"
            className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading && !detail ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Opening dossier…
          </p>
        ) : detail ? (
          <>
            {/* stats */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {([
                ['Live sessions', detail.liveSessions ?? 0, 'emerald'],
                ['Assigned tasks', drawerTasks.filter((t) => t.status !== 'done').length, 'gold'],
                ['Audit actions', drawerAudit.length >= 12 ? `${drawerAudit.length}+` : drawerAudit.length, 'default'],
                ['Joined', fmtDate(m.createdAt), 'default'],
              ] as const).map(([label, val, tone]) => (
                <div key={label} className="rounded-lg bg-white/[0.03] px-3 py-2">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
                  <p className={cn('mt-0.5 font-mono text-lg font-semibold tabular-nums',
                    tone === 'emerald' ? 'text-emerald-300' : tone === 'gold' ? 'text-amber-300' : 'text-zinc-100')}>
                    {val}
                  </p>
                </div>
              ))}
            </div>

            {/* assigned tasks */}
            <div className="mt-4">
              <SectionTitle icon={<ClipboardList className="h-3 w-3" />}>Assigned tasks ({drawerTasks.length})</SectionTitle>
              {drawerTasks.length === 0 ? (
                <p className="rounded-lg bg-white/[0.02] py-3 text-center text-[11px] text-zinc-600">No tasks assigned yet.</p>
              ) : (
                <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1 nuvia-scroll">
                  {drawerTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full',
                        STATUS_COLS.find((c) => c.key === t.status)?.dot)} />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-200">{t.title}</span>
                      <DarkBadge tone={PRIO_TONE[t.priority] ?? 'zinc'}>{t.priority}</DarkBadge>
                      {isOverdue(t) && <DarkBadge tone="danger">overdue</DarkBadge>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* recent audit activity */}
            <div className="mt-4">
              <SectionTitle icon={<Radio className="h-3 w-3" />}>Recent activity</SectionTitle>
              {drawerAudit.length === 0 ? (
                <p className="rounded-lg bg-white/[0.02] py-3 text-center text-[11px] text-zinc-600">No audit trail yet.</p>
              ) : (
                <div className="max-h-44 space-y-1 overflow-y-auto pr-1 nuvia-scroll">
                  {drawerAudit.map((a) => (
                    <div key={a.id} className="flex items-start gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                      <span className="mt-0.5 shrink-0 font-mono text-[10px] text-amber-300/80">{a.action}</span>
                      <span className="min-w-0 flex-1 truncate text-[10px] text-zinc-500">{a.details ?? a.targetLabel ?? '—'}</span>
                      <span className="shrink-0 font-mono text-[9px] text-zinc-600">{fmtRelative(a.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}

        {/* controls */}
        <div className="mt-4 space-y-2 border-t border-white/10 pt-3.5">
          <SectionTitle icon={<Pencil className="h-3 w-3" />}>Quick controls</SectionTitle>
          {!isSelf && (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={() => void act(m.active ? 'deactivate' : 'activate')}
                  className={cn('h-7 px-2.5 text-[11px]',
                    m.active ? 'border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20'
                      : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20')}>
                  {m.active ? 'Deactivate' : 'Activate'}
                </Button>
                <Select value={m.role} onValueChange={(v) => void act('set_role', v)}>
                  <SelectTrigger className={`h-7 w-[120px] px-2 text-[11px] ${inputDarkCls}`} aria-label="Change role"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={m.department ?? 'none'} onValueChange={(v) => void act('set_department', v === 'none' ? '' : v)}>
                  <SelectTrigger className={`h-7 w-[140px] px-2 text-[11px] ${inputDarkCls}`} aria-label="Change department"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
                    <SelectItem value="none">no dept</SelectItem>
                    {departments.map((d) => <SelectItem key={d.id} value={d.key}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <ConfirmButton onConfirm={() => void act('reset_password')} tone="gold" className="h-7">
                  Reset password
                </ConfirmButton>
                <ConfirmButton onConfirm={() => void removeMember()} tone="rose" className="h-7" confirmLabel="Remove for real?">
                  <Trash2 className="h-3 w-3" /> Remove from team
                </ConfirmButton>
              </div>
            </>
          )}
          {isSelf && (
            <p className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[11px] text-amber-200/80">
              Founder account — role, password and removal are protected at the database level.
            </p>
          )}
        </div>

        {creds && <CredsCard creds={creds} onClose={() => setCreds(null)} />}
      </motion.aside>
    </motion.div>
  )
}

// ═══ Departments ═════════════════════════════════════════════════════════════
function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {DEPT_COLORS.map((c) => (
        <button key={c} onClick={() => onChange(c)} aria-label={`Color ${c}`}
          className={cn('h-5 w-5 rounded-full border transition-transform hover:scale-110',
            value === c ? 'border-white ring-2 ring-white/30' : 'border-white/20')}
          style={{ background: c }} />
      ))}
    </div>
  )
}

function DeptEditModal({
  open, dept, onClose, adminFetch, reload,
}: {
  open: boolean; dept: Department | null; onClose: () => void
  adminFetch: AdminFetch; reload: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(DEPT_COLORS[0])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (dept) { setName(dept.name); setDescription(dept.description ?? ''); setColor(dept.color) }
  }, [dept])

  const save = async () => {
    if (!dept || !name.trim()) { toast.error('Name is required.'); return }
    setBusy(true)
    try {
      await adminFetch('/api/admin/departments', {
        method: 'PATCH',
        body: JSON.stringify({ id: dept.id, name: name.trim(), description: description || null, color }),
      })
      toast.success('Department updated')
      await reload()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DarkModal open={open && !!dept} onClose={onClose} title={`Edit department — ${dept?.name ?? ''}`}>
      <div className="space-y-2.5">
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">Name</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} className={`h-8 text-xs ${inputDarkCls}`} />
        </div>
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">What this team owns</p>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} className={`h-8 text-xs ${inputDarkCls}`} />
        </div>
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">Color</p>
          <ColorSwatches value={color} onChange={setColor} />
        </div>
        <Button size="sm" onClick={() => void save()} disabled={busy}
          className="h-8 w-full bg-amber-400 font-semibold text-[#0a0810] hover:bg-amber-300">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save changes'}
        </Button>
      </div>
    </DarkModal>
  )
}

function OrgDesk({
  adminFetch, departments, reload, members,
}: {
  adminFetch: AdminFetch; departments: Department[]; reload: () => Promise<void>; members: Member[]
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(DEPT_COLORS[3])
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)

  const create = async () => {
    if (!name.trim()) { toast.error('Department name is required.'); return }
    setBusy(true)
    try {
      await adminFetch('/api/admin/departments', {
        method: 'POST',
        body: JSON.stringify({ name, description: description || undefined, color }),
      })
      toast.success('Department created')
      setName(''); setDescription('')
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await adminFetch(`/api/admin/departments?id=${id}`, { method: 'DELETE' })
      toast.success('Department deleted')
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const totalMembers = departments.reduce((acc, d) => acc + d.memberCount, 0)

  return (
    <div className="space-y-3.5">
      <div className={panelCls + ' p-4'}>
        <SectionTitle icon={<Building2 className="h-3 w-3" />}>New department</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Data Science" className={inputDarkCls}
            onKeyDown={(e) => e.key === 'Enter' && void create()} />
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="what this team owns…" className={inputDarkCls}
            onKeyDown={(e) => e.key === 'Enter' && void create()} />
          <Button size="sm" onClick={() => void create()} disabled={busy}
            className="h-9 bg-amber-400 font-semibold text-[#0a0810] hover:bg-amber-300">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5" /> Add</>}
          </Button>
        </div>
        <div className="mt-2.5">
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">Color tag</p>
          <ColorSwatches value={color} onChange={setColor} />
        </div>
      </div>

      <div className={panelCls + ' p-4'}>
        <SectionTitle>
          Org structure ({departments.length}) · {members.length - totalMembers} unassigned of {members.length}
        </SectionTitle>
        {departments.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-600">No departments yet — create your first above.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {departments.map((d) => (
              <motion.div key={d.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-white/[0.03] p-3" style={{ borderTop: `3px solid ${d.color}` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-zinc-100">{d.name}</p>
                    <p className="font-mono text-[9px] text-zinc-600">key: {d.key}</p>
                  </div>
                  <button onClick={() => setEditing(d)} aria-label={`Edit ${d.name}`}
                    className="rounded p-1 text-zinc-600 transition-colors hover:bg-white/10 hover:text-amber-300">
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
                {d.description && <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-zinc-500">{d.description}</p>}

                {/* member stack */}
                <div className="mt-2 flex items-center gap-1">
                  {d.members.length === 0 ? (
                    <span className="text-[10px] text-zinc-600">no members assigned</span>
                  ) : (
                    <>
                      {d.members.slice(0, 6).map((mem) => (
                        <span key={mem.id} title={`${mem.name} · ${mem.role}`}>
                          <OperatorAvatar name={mem.name} role={mem.role} size="sm" />
                        </span>
                      ))}
                      {d.members.length > 6 && (
                        <span className="font-mono text-[9px] text-zinc-500">+{d.members.length - 6}</span>
                      )}
                    </>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <DarkBadge tone="zinc">{d.memberCount} members</DarkBadge>
                  <DarkBadge tone="gold">{d.openTaskCount} open</DarkBadge>
                  <DarkBadge tone={d.taskCount > 0 ? 'emerald' : 'zinc'}>{d.taskCount} total tasks</DarkBadge>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2">
                  <span className="font-mono text-[9px] text-zinc-600">since {fmtDate(d.createdAt)}</span>
                  <ConfirmButton onConfirm={() => remove(d.id)} className="h-6 px-1.5 py-0 text-[9px]" confirmLabel="Delete?">
                    <Trash2 className="h-2.5 w-2.5" /> Delete
                  </ConfirmButton>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <DeptEditModal open={!!editing} dept={editing} onClose={() => setEditing(null)} adminFetch={adminFetch} reload={reload} />
    </div>
  )
}

// ═══ Workflow board ══════════════════════════════════════════════════════════
function TaskEditModal({
  open, task, departments, members, onClose, adminFetch, reload,
}: {
  open: boolean; task: Task | null; departments: Department[]; members: Member[]
  onClose: () => void; adminFetch: AdminFetch; reload: () => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('backlog')
  const [priority, setPriority] = useState('medium')
  const [deptId, setDeptId] = useState('none')
  const [assigneeId, setAssigneeId] = useState('none')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title); setDescription(task.description ?? ''); setStatus(task.status)
      setPriority(task.priority); setDeptId(task.departmentId ?? 'none')
      setAssigneeId(task.assignee?.id ?? 'none'); setDue(task.dueDate ? task.dueDate.slice(0, 10) : '')
    }
  }, [task])

  const save = async () => {
    if (!task || !title.trim()) { toast.error('Title is required.'); return }
    setBusy(true)
    try {
      await adminFetch('/api/admin/tasks', {
        method: 'PATCH',
        body: JSON.stringify({
          id: task.id, title: title.trim(), description: description || null, status, priority,
          departmentId: deptId === 'none' ? null : deptId,
          assigneeId: assigneeId === 'none' ? null : assigneeId,
          dueDate: due ? new Date(`${due}T12:00:00`).toISOString() : null,
        }),
      })
      toast.success('Task updated')
      await reload()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DarkModal open={open && !!task} onClose={onClose} title="Edit task" wide>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">Title</p>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className={`h-8 text-xs ${inputDarkCls}`} />
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">Description</p>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            placeholder="context, acceptance criteria, links…" className={`text-xs ${inputDarkCls}`} />
        </div>
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">Status</p>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={`h-8 w-full text-xs ${inputDarkCls}`} aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
              {STATUS_COLS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">Priority</p>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className={`h-8 w-full text-xs ${inputDarkCls}`} aria-label="Priority"><SelectValue /></SelectTrigger>
            <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
              {['low', 'medium', 'high', 'urgent'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">Department</p>
          <Select value={deptId} onValueChange={setDeptId}>
            <SelectTrigger className={`h-8 w-full text-xs ${inputDarkCls}`} aria-label="Department"><SelectValue /></SelectTrigger>
            <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
              <SelectItem value="none">no dept</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">Assignee</p>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger className={`h-8 w-full text-xs ${inputDarkCls}`} aria-label="Assignee"><SelectValue /></SelectTrigger>
            <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
              <SelectItem value="none">unassigned</SelectItem>
              {members.filter((m) => m.active).map((mm) => <SelectItem key={mm.id} value={mm.id}>{mm.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">Due date</p>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)}
            className={`h-8 text-xs [color-scheme:dark] ${inputDarkCls}`} />
        </div>
        <Button size="sm" onClick={() => void save()} disabled={busy}
          className="h-8 sm:col-span-2 bg-amber-400 font-semibold text-[#0a0810] hover:bg-amber-300">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save task'}
        </Button>
      </div>
    </DarkModal>
  )
}

function BoardDesk({
  adminFetch, tasks, departments, members, reload, onOptimisticMove,
}: {
  adminFetch: AdminFetch; tasks: Task[]; departments: Department[]; members: Member[]
  reload: () => Promise<void>; onOptimisticMove: (id: string, status: string) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [departmentId, setDepartmentId] = useState('none')
  const [assigneeId, setAssigneeId] = useState('none')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)

  // filters
  const [fDept, setFDept] = useState('all')
  const [fAssignee, setFAssignee] = useState('all')
  const [fPrio, setFPrio] = useState('all')

  // drag & drop
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)

  const filtered = useMemo(() => tasks.filter((t) =>
    (fDept === 'all' || (fDept === 'nodept' ? !t.departmentId : t.departmentId === fDept)) &&
    (fAssignee === 'all' || (fAssignee === 'unassigned' ? !t.assignee : t.assignee?.id === fAssignee)) &&
    (fPrio === 'all' || t.priority === fPrio)
  ), [tasks, fDept, fAssignee, fPrio])

  const hasFilters = fDept !== 'all' || fAssignee !== 'all' || fPrio !== 'all'

  const create = async () => {
    if (!title.trim()) { toast.error('Task title is required.'); return }
    setBusy(true)
    try {
      await adminFetch('/api/admin/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title, description: description || undefined, priority,
          departmentId: departmentId === 'none' ? undefined : departmentId,
          assigneeId: assigneeId === 'none' ? undefined : assigneeId,
          dueDate: due ? new Date(`${due}T12:00:00`).toISOString() : undefined,
        }),
      })
      toast.success('Task added to backlog')
      setTitle(''); setDescription(''); setDue('')
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  const move = async (id: string, status: string) => {
    const task = tasks.find((t) => t.id === id)
    if (!task || task.status === status) return
    onOptimisticMove(id, status) // instant column swap in the shared state
    try {
      await adminFetch('/api/admin/tasks', { method: 'PATCH', body: JSON.stringify({ id, status }) })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Move failed')
      await reload()
    }
  }

  const remove = async (id: string) => {
    try {
      await adminFetch(`/api/admin/tasks?id=${id}`, { method: 'DELETE' })
      toast.success('Task deleted')
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="space-y-3.5">
      {/* new task */}
      <div className={panelCls + ' p-4'}>
        <SectionTitle icon={<Plus className="h-3 w-3" />}>New task</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[1.6fr_0.8fr_1fr_1fr_0.9fr_auto]">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to happen?" className={inputDarkCls}
            onKeyDown={(e) => e.key === 'Enter' && void create()} />
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className={`w-full ${inputDarkCls}`} aria-label="Priority"><SelectValue /></SelectTrigger>
            <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
              {['low', 'medium', 'high', 'urgent'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className={`w-full ${inputDarkCls}`} aria-label="Department"><SelectValue /></SelectTrigger>
            <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
              <SelectItem value="none">no dept</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger className={`w-full ${inputDarkCls}`} aria-label="Assignee"><SelectValue /></SelectTrigger>
            <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
              <SelectItem value="none">unassigned</SelectItem>
              {members.filter((m) => m.active).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date"
            className={`text-xs [color-scheme:dark] ${inputDarkCls}`} />
          <Button size="sm" onClick={() => void create()} disabled={busy}
            className="h-9 bg-amber-400 font-semibold text-[#0a0810] hover:bg-amber-300">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="add context (optional) — press Enter in the title field to ship it"
          className={`mt-2 h-7 text-xs ${inputDarkCls}`} onKeyDown={(e) => e.key === 'Enter' && void create()} />
      </div>

      {/* filters */}
      <div className={panelCls + ' flex flex-wrap items-center gap-2 p-2.5'}>
        <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">Filter</span>
        <Select value={fDept} onValueChange={setFDept}>
          <SelectTrigger className={`h-7 w-[130px] text-[11px] ${inputDarkCls}`} aria-label="Filter department"><SelectValue /></SelectTrigger>
          <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
            <SelectItem value="all">all depts</SelectItem>
            <SelectItem value="nodept">no dept</SelectItem>
            {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fAssignee} onValueChange={setFAssignee}>
          <SelectTrigger className={`h-7 w-[130px] text-[11px] ${inputDarkCls}`} aria-label="Filter assignee"><SelectValue /></SelectTrigger>
          <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
            <SelectItem value="all">all assignees</SelectItem>
            <SelectItem value="unassigned">unassigned</SelectItem>
            {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fPrio} onValueChange={setFPrio}>
          <SelectTrigger className={`h-7 w-[110px] text-[11px] ${inputDarkCls}`} aria-label="Filter priority"><SelectValue /></SelectTrigger>
          <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
            <SelectItem value="all">all priorities</SelectItem>
            {['urgent', 'high', 'medium', 'low'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <button onClick={() => { setFDept('all'); setFAssignee('all'); setFPrio('all') }}
            className="flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-1 font-mono text-[10px] text-zinc-400 transition-colors hover:text-zinc-200">
            <X className="h-3 w-3" /> clear
          </button>
        )}
        <span className="ml-auto font-mono text-[10px] text-zinc-600">
          {filtered.length} of {tasks.length} shown · drag cards between columns
        </span>
      </div>

      {/* board */}
      {filtered.length === 0 && tasks.length > 0 ? (
        <p className="py-8 text-center text-sm text-zinc-600">No tasks match these filters.</p>
      ) : tasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-600">The board is empty — add your first task above.</p>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {STATUS_COLS.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.key)
            return (
              <div key={col.key}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverCol(col.key) }}
                onDragLeave={() => setOverCol((cur) => (cur === col.key ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = dragId
                  setOverCol(null); setDragId(null)
                  if (id) void move(id, col.key)
                }}
                className={cn(panelCls, 'flex min-h-[120px] flex-col p-2.5 transition-shadow',
                  overCol === col.key && 'ring-2 ring-amber-400/50')}>
                <p className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <i className={cn('h-1.5 w-1.5 rounded-full', col.dot)} />
                    {col.label}
                  </span>
                  <span className="text-zinc-600">{colTasks.length}</span>
                </p>
                <div className="flex-1 space-y-1.5">
                  {colTasks.length === 0 && <p className="py-4 text-center text-[11px] text-zinc-700">drop here</p>}
                  {colTasks.map((t) => (
                    <div key={t.id} draggable
                      onDragStart={(e) => {
                        setDragId(t.id)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', t.id)
                      }}
                      onDragEnd={() => { setDragId(null); setOverCol(null) }}
                      className={cn('group cursor-grab rounded-lg bg-white/[0.04] p-2 transition-colors hover:bg-white/[0.07] active:cursor-grabbing',
                        dragId === t.id && 'opacity-40')}>
                      <div className="flex items-start gap-1.5">
                        <span className={cn('mt-0.5 h-3.5 w-1 shrink-0 rounded-full', PRIO_STRIPE[t.priority] ?? 'bg-zinc-600')} />
                        <p className="min-w-0 flex-1 text-[11px] font-medium leading-snug text-zinc-100">{t.title}</p>
                        <button onClick={() => setEditing(t)} aria-label="Edit task"
                          className="rounded p-0.5 text-zinc-600 opacity-0 transition-all hover:text-amber-300 group-hover:opacity-100">
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                      {t.description && <p className="mt-1 line-clamp-2 pl-2.5 text-[10px] leading-snug text-zinc-500">{t.description}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-2.5">
                        <DarkBadge tone={PRIO_TONE[t.priority] ?? 'zinc'}>{t.priority}</DarkBadge>
                        {t.department && <DeptChip name={t.department.name} color={t.department.color} />}
                        {t.assignee && (
                          <span className="inline-flex items-center gap-1 font-mono text-[9px] text-zinc-400">
                            <OperatorAvatar name={t.assignee.name} role="moderator" size="sm" />
                            {t.assignee.name.split(' ')[0]}
                          </span>
                        )}
                        {t.dueDate && (
                          <span className={cn('font-mono text-[9px]', isOverdue(t) ? 'font-semibold text-red-400' : 'text-zinc-500')}>
                            <CalendarGlyph date={t.dueDate} overdue={isOverdue(t)} />
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1 pl-2.5">
                        {STATUS_COLS.filter((c) => c.key !== t.status).map((c) => (
                          <button key={c.key} onClick={() => void move(t.id, c.key)} title={`Move to ${c.label}`}
                            className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-zinc-400 transition-colors hover:border-amber-400/40 hover:text-amber-300">
                            {c.label.slice(0, 4).toLowerCase()}
                          </button>
                        ))}
                        <ConfirmButton onConfirm={() => remove(t.id)} className="ml-auto h-5 px-1.5 py-0 text-[9px]" confirmLabel="Delete?">✕</ConfirmButton>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <TaskEditModal open={!!editing} task={editing} departments={departments} members={members}
        onClose={() => setEditing(null)} adminFetch={adminFetch} reload={reload} />
    </div>
  )
}

// tiny due-date glyph for task cards
function CalendarGlyph({ date, overdue }: { date: string; overdue: boolean }) {
  const d = new Date(date)
  const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return (
    <span className={cn('inline-flex items-center gap-0.5', overdue && 'text-red-400')}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      {label}{overdue ? ' · overdue' : ''}
    </span>
  )
}
