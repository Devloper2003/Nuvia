import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/admin-guard'

const STATUSES = ['backlog', 'in_progress', 'review', 'done']
const PRIORITIES = ['low', 'medium', 'high', 'urgent']

// ─── GET /api/admin/tasks ────────────────────────────────────────────────────
// Workflow board. Filters: ?department=&status=&assignee=
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const department = searchParams.get('department') ?? undefined
  const status = searchParams.get('status') ?? undefined
  const assignee = searchParams.get('assignee') ?? undefined

  const tasks = await db.teamTask.findMany({
    where: {
      ...(department ? { departmentId: department } : {}),
      ...(status && STATUSES.includes(status) ? { status } : {}),
      ...(assignee ? { assigneeId: assignee } : {}),
    },
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
    include: {
      department: { select: { name: true, key: true, color: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({ tasks })
}

// ─── POST /api/admin/tasks ───────────────────────────────────────────────────
// Body: { title, description?, departmentId?, assigneeId?, priority?, dueDate? }
export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const b = await request.json()
    const title = String(b.title ?? '').trim()
    if (!title) return NextResponse.json({ error: 'Task title is required' }, { status: 400 })

    const task = await db.teamTask.create({
      data: {
        title: title.slice(0, 200),
        description: b.description ? String(b.description).slice(0, 2000) : null,
        departmentId: b.departmentId || null,
        assigneeId: b.assigneeId || null,
        priority: PRIORITIES.includes(b.priority) ? b.priority : 'medium',
        status: 'backlog',
        dueDate: b.dueDate ? new Date(b.dueDate) : null,
        createdByName: admin.name,
      },
    })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    await db.auditLog.create({
      data: {
        adminId: admin.id, adminName: admin.name, action: 'org:task_create',
        targetType: 'task', targetId: task.id, targetLabel: title.slice(0, 100),
        details: `priority=${task.priority}`, ipAddress: ip,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, task })
  } catch (error) {
    console.error('Task create error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

// ─── PATCH /api/admin/tasks ──────────────────────────────────────────────────
// Body: { id, status?, assigneeId?, priority?, dueDate?, title?, description? }
export async function PATCH(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const b = await request.json()
    const { id } = b
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const data: Record<string, unknown> = {}
    const changes: string[] = []

    if (STATUSES.includes(b.status)) { data.status = b.status; changes.push(`status → ${b.status}`) }
    if (PRIORITIES.includes(b.priority)) { data.priority = b.priority; changes.push(`priority → ${b.priority}`) }
    if (b.assigneeId !== undefined) {
      data.assigneeId = b.assigneeId || null
      changes.push(b.assigneeId ? 'assignee set' : 'assignee cleared')
    }
    if (b.dueDate !== undefined) { data.dueDate = b.dueDate ? new Date(b.dueDate) : null; changes.push('due date updated') }
    if (typeof b.title === 'string' && b.title.trim()) data.title = b.title.trim().slice(0, 200)
    if (b.description !== undefined) data.description = b.description ? String(b.description).slice(0, 2000) : null
    if (b.departmentId !== undefined) data.departmentId = b.departmentId || null

    const task = await db.teamTask.update({ where: { id }, data })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    await db.auditLog.create({
      data: {
        adminId: admin.id, adminName: admin.name, action: 'org:task_update',
        targetType: 'task', targetId: id, targetLabel: task.title.slice(0, 100),
        details: changes.join(' · ') || 'edited', ipAddress: ip,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, task })
  } catch (error) {
    console.error('Task patch error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

// ─── DELETE /api/admin/tasks?id=... ──────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const existing = await db.teamTask.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  await db.teamTask.delete({ where: { id } })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
  await db.auditLog.create({
    data: {
      adminId: admin.id, adminName: admin.name, action: 'org:task_delete',
      targetType: 'task', targetId: id, targetLabel: existing.title.slice(0, 100),
      details: 'deleted', ipAddress: ip,
    },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
