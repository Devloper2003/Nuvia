'use client'

// ─── Basement · Team HQ ──────────────────────────────────────────────────────
// Internal org: invite operators, manage departments, run the workflow board
// (backlog → in_progress → review → done). SUPER_ADMIN only.

import { useCallback, useEffect, useState } from 'react'
import { Building2, Loader2, Plus, Users2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  AdminFetch, ConfirmButton, DarkBadge, SectionTitle, fmtDate, fmtRelative, inputDarkCls, panelCls,
} from './basement-shared'

type Member = {
  id: string; email: string; name: string; role: string; department: string | null
  active: boolean; lastLoginAt: string | null; createdAt: string
  liveSessions: number; openTasks: number; auditActions: number
}

type Department = {
  id: string; name: string; key: string; description: string | null
  color: string; taskCount: number; memberCount: number
}

type Task = {
  id: string; title: string; description: string | null; status: string; priority: string
  dueDate: string | null; departmentId: string | null; createdByName: string | null
  department: { name: string; key: string; color: string } | null
  assignee: { id: string; name: string; email: string } | null
}

const STATUS_COLS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
] as const

const ROLES = ['admin', 'moderator'] // super_admin is assigned via DB only — founder-controlled

export function BasementTeam({ adminFetch }: { adminFetch: AdminFetch }) {
  const [view, setView] = useState<'members' | 'org' | 'board'>('members')
  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-1.5">
        {([['members', 'Members'], ['org', 'Departments'], ['board', 'Workflow board']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              view === v ? 'border border-amber-400/30 bg-amber-400/10 text-amber-300' : 'text-zinc-500 hover:text-zinc-300'
            }`}>
            {label}
          </button>
        ))}
      </div>
      {view === 'members' && <MembersDesk adminFetch={adminFetch} />}
      {view === 'org' && <OrgDesk adminFetch={adminFetch} />}
      {view === 'board' && <BoardDesk adminFetch={adminFetch} />}
    </div>
  )
}

// ═══ Members ═════════════════════════════════════════════════════════════════
function MembersDesk({ adminFetch }: { adminFetch: AdminFetch }) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('moderator')
  const [department, setDepartment] = useState('')
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminFetch<{ members: Member[] }>('/api/admin/team')
      setMembers(data.members)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load team')
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => { void load() }, [load])

  const invite = async () => {
    if (!email.trim() || !name.trim()) {
      toast.error('Name and email are required.')
      return
    }
    setBusy(true)
    try {
      const data = await adminFetch<{ credentials: { email: string; password: string } }>('/api/admin/team', {
        method: 'POST',
        body: JSON.stringify({ email, name, role, department: department || undefined }),
      })
      setCreds(data.credentials)
      toast.success(`${name} added to the team`)
      setEmail(''); setName(''); setDepartment('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invite failed')
    } finally {
      setBusy(false)
    }
  }

  const patch = async (id: string, action: string, value?: string) => {
    try {
      const res = await adminFetch<{ message?: string; credentials?: { email: string; password: string } }>('/api/admin/team', {
        method: 'PATCH',
        body: JSON.stringify({ id, action, value }),
      })
      if (res.credentials) setCreds(res.credentials)
      else toast.success(res.message ?? 'Updated')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  return (
    <div className="space-y-3.5">
      <div className={panelCls + ' p-4'}>
        <SectionTitle icon={<Users2 className="h-3 w-3" />}>Invite a team member</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputDarkCls} />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="work email" type="email" className={inputDarkCls} />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className={`w-full ${inputDarkCls}`} aria-label="Role"><SelectValue /></SelectTrigger>
            <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
              <SelectItem value="admin">admin</SelectItem>
              <SelectItem value="moderator">moderator</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="dept key (content)" className={inputDarkCls} />
            <Button size="sm" onClick={() => void invite()} disabled={busy}
              className="h-9 shrink-0 bg-amber-400 font-semibold text-[#0a0810] hover:bg-amber-300">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        {creds && (
          <div className="mt-2.5 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-amber-300">One-time credentials — copy now, shown only once</p>
            <p className="mt-1 font-mono text-xs text-zinc-200">{creds.email} / <span className="select-all font-semibold text-amber-300">{creds.password}</span></p>
            <button className="mt-1 text-[10px] text-zinc-500 underline hover:text-zinc-300" onClick={() => { void navigator.clipboard.writeText(`${creds.email} / ${creds.password}`); toast.success('Copied') }}>copy</button>
          </div>
        )}
      </div>

      <div className={panelCls + ' p-4'}>
        <SectionTitle>Team roster ({members.length})</SectionTitle>
        {loading && members.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading roster…</p>
        ) : (
          <div className="space-y-1.5">
            {members.map((m) => (
              <div key={m.id} className="rounded-lg bg-white/[0.03] px-2.5 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-400/15 text-[10px] font-semibold text-rose-200">
                    {(m.name ?? m.email)[0]?.toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-zinc-200">
                      {m.name}
                      {m.role === 'super_admin' && <span className="ml-1.5 text-[10px] font-semibold text-amber-300">★ founder-level</span>}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-zinc-600">{m.email}{m.department ? ` · ${m.department}` : ''}</span>
                  </span>
                  <DarkBadge tone={m.role === 'super_admin' ? 'gold' : m.role === 'admin' ? 'rose' : 'zinc'}>{m.role}</DarkBadge>
                  <DarkBadge tone={m.active ? 'emerald' : 'danger'}>{m.active ? 'active' : 'off'}</DarkBadge>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {m.liveSessions} live · {m.openTasks} tasks · {m.auditActions} actions · last in {fmtRelative(m.lastLoginAt)}
                  </span>
                </div>
                {m.role !== 'super_admin' && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => void patch(m.id, m.active ? 'deactivate' : 'activate')}
                      className={`h-6.5 px-2 py-0 text-[11px] ${m.active ? 'border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20'}`}>
                      {m.active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Select value={m.role} onValueChange={(v) => void patch(m.id, 'set_role', v)}>
                      <SelectTrigger className={`h-6.5 w-[110px] px-2 py-0 text-[11px] ${inputDarkCls}`} aria-label="Change role"><SelectValue /></SelectTrigger>
                      <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
                        {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <ConfirmButton onConfirm={() => patch(m.id, 'reset_password')} tone="gold" className="h-6.5 py-0">
                      Reset password
                    </ConfirmButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══ Departments ═════════════════════════════════════════════════════════════
function OrgDesk({ adminFetch }: { adminFetch: AdminFetch }) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminFetch<{ departments: Department[] }>('/api/admin/departments')
      setDepartments(data.departments)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load departments')
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => { void load() }, [load])

  const create = async () => {
    if (!name.trim()) {
      toast.error('Department name is required.')
      return
    }
    try {
      await adminFetch('/api/admin/departments', { method: 'POST', body: JSON.stringify({ name, description: description || undefined }) })
      toast.success('Department created')
      setName(''); setDescription('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    }
  }

  const remove = async (id: string) => {
    try {
      await adminFetch(`/api/admin/departments?id=${id}`, { method: 'DELETE' })
      toast.success('Department deleted')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="space-y-3.5">
      <div className={panelCls + ' p-4'}>
        <SectionTitle icon={<Building2 className="h-3 w-3" />}>New department</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Data Science" className={inputDarkCls} />
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="what this team owns…" className={inputDarkCls} />
          <Button size="sm" onClick={() => void create()} className="h-9 bg-amber-400 font-semibold text-[#0a0810] hover:bg-amber-300">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>

      <div className={panelCls + ' p-4'}>
        <SectionTitle>Org structure ({departments.length})</SectionTitle>
        {loading && departments.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading org…</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {departments.map((d) => (
              <div key={d.id} className="rounded-lg bg-white/[0.03] p-3" style={{ borderLeft: `3px solid ${d.color}` }}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200">{d.name}</span>
                  <DarkBadge tone="zinc">{d.memberCount} members</DarkBadge>
                  <DarkBadge tone="gold">{d.taskCount} tasks</DarkBadge>
                </div>
                {d.description && <p className="mt-1 truncate text-[11px] text-zinc-500">{d.description}</p>}
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-zinc-600">key: {d.key} · since {fmtDate(d.createdAt)}</span>
                  <ConfirmButton onConfirm={() => remove(d.id)} className="h-6 py-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    Delete
                  </ConfirmButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══ Workflow board ══════════════════════════════════════════════════════════
function BoardDesk({ adminFetch }: { adminFetch: AdminFetch }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [departmentId, setDepartmentId] = useState('none')
  const [assigneeId, setAssigneeId] = useState('none')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t, d, m] = await Promise.all([
        adminFetch<{ tasks: Task[] }>('/api/admin/tasks'),
        adminFetch<{ departments: Department[] }>('/api/admin/departments'),
        adminFetch<{ members: Member[] }>('/api/admin/team'),
      ])
      setTasks(t.tasks); setDepartments(d.departments); setMembers(m.members.filter((x) => x.active))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load board')
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => { void load() }, [load])

  const create = async () => {
    if (!title.trim()) {
      toast.error('Task title is required.')
      return
    }
    try {
      await adminFetch('/api/admin/tasks', {
        method: 'POST',
        body: JSON.stringify({ title, priority, departmentId: departmentId === 'none' ? undefined : departmentId, assigneeId: assigneeId === 'none' ? undefined : assigneeId }),
      })
      toast.success('Task added to backlog')
      setTitle('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    }
  }

  const move = async (id: string, status: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t))) // optimistic
    try {
      await adminFetch('/api/admin/tasks', { method: 'PATCH', body: JSON.stringify({ id, status }) })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Move failed')
      await load()
    }
  }

  const remove = async (id: string) => {
    try {
      await adminFetch(`/api/admin/tasks?id=${id}`, { method: 'DELETE' })
      toast.success('Task deleted')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const prioTone: Record<string, string> = { urgent: 'danger', high: 'rose', medium: 'gold', low: 'zinc' }

  return (
    <div className="space-y-3.5">
      <div className={panelCls + ' p-4'}>
        <SectionTitle icon={<Plus className="h-3 w-3" />}>New task</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-[1.5fr_0.8fr_1fr_1fr_auto]">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to happen?" className={inputDarkCls}
            onKeyDown={(e) => e.key === 'Enter' && void create()} />
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className={`w-full ${inputDarkCls}`} aria-label="Priority"><SelectValue /></SelectTrigger>
            <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
              <SelectItem value="low">low</SelectItem>
              <SelectItem value="medium">medium</SelectItem>
              <SelectItem value="high">high</SelectItem>
              <SelectItem value="urgent">urgent</SelectItem>
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
              {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => void create()} className="h-9 bg-amber-400 font-semibold text-[#0a0810] hover:bg-amber-300">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {loading && tasks.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading board…</p>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {STATUS_COLS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.key)
            return (
              <div key={col.key} className={panelCls + ' flex flex-col p-2.5'}>
                <p className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                  {col.label} <span className="text-zinc-600">{colTasks.length}</span>
                </p>
                <div className="flex-1 space-y-1.5">
                  {colTasks.length === 0 && <p className="py-4 text-center text-[11px] text-zinc-700">empty</p>}
                  {colTasks.map((t) => (
                    <div key={t.id} className="rounded-lg bg-white/[0.04] p-2">
                      <p className="text-[11px] leading-snug text-zinc-200">{t.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <DarkBadge tone={prioTone[t.priority] ?? 'zinc'}>{t.priority}</DarkBadge>
                        {t.department && <DarkBadge tone="zinc">{t.department.name}</DarkBadge>}
                        {t.assignee && <span className="font-mono text-[9px] text-zinc-500">→ {t.assignee.name}</span>}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1">
                        {STATUS_COLS.filter((c) => c.key !== t.status).map((c) => (
                          <button key={c.key} onClick={() => void move(t.id, c.key)} title={`Move to ${c.label}`}
                            className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-zinc-400 transition-colors hover:border-amber-400/40 hover:text-amber-300">
                            {c.label.slice(0, 4).toLowerCase()}
                          </button>
                        ))}
                        <ConfirmButton onConfirm={() => remove(t.id)} className="ml-auto h-5 px-1.5 py-0 text-[9px]">✕</ConfirmButton>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
