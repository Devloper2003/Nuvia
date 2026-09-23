import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/admin-guard'

function keyify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `dept-${Date.now()}`
}

// ─── GET /api/admin/departments ──────────────────────────────────────────────
// Org structure with live task + member counts + member roster per dept.
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const departments = await db.department.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { tasks: true } } },
  })
  const memberRows = await db.adminUser.findMany({
    select: { id: true, name: true, role: true, department: true, active: true },
  })

  const roster = new Map<string, { id: string; name: string; role: string; active: boolean }[]>()
  for (const m of memberRows) {
    if (!m.department) continue
    const list = roster.get(m.department) ?? []
    list.push({ id: m.id, name: m.name, role: m.role, active: m.active })
    roster.set(m.department, list)
  }

  const openCounts = await db.teamTask.groupBy({
    by: ['departmentId', 'status'],
    where: { departmentId: { not: null }, status: { not: 'done' } },
    _count: { _all: true },
  })
  const openMap = new Map<string, number>()
  for (const row of openCounts) {
    if (!row.departmentId) continue
    openMap.set(row.departmentId, (openMap.get(row.departmentId) ?? 0) + row._count._all)
  }

  return NextResponse.json({
    departments: departments.map((d) => ({
      id: d.id, name: d.name, key: d.key, description: d.description, color: d.color,
      createdAt: d.createdAt, taskCount: d._count.tasks, openTaskCount: openMap.get(d.id) ?? 0,
      memberCount: roster.get(d.key)?.length ?? 0,
      members: roster.get(d.key) ?? [],
    })),
  })
}

// ─── POST /api/admin/departments ─────────────────────────────────────────────
// Body: { name, description?, color? }
export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const b = await request.json()
    const name = String(b.name ?? '').trim()
    if (!name) return NextResponse.json({ error: 'Department name is required' }, { status: 400 })

    const department = await db.department.create({
      data: {
        name: name.slice(0, 60),
        key: keyify(name),
        description: b.description ? String(b.description).slice(0, 300) : null,
        color: /^#[0-9a-fA-F]{6}$/.test(b.color ?? '') ? b.color : '#f43f5e',
      },
    })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    await db.auditLog.create({
      data: {
        adminId: admin.id, adminName: admin.name, action: 'org:department_create',
        targetType: 'department', targetId: department.id, targetLabel: department.name,
        details: `key=${department.key}`, ipAddress: ip,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, department })
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'A department with that name already exists' }, { status: 409 })
    }
    console.error('Department create error:', error)
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 })
  }
}

// ─── PATCH /api/admin/departments ────────────────────────────────────────────
// Body: { id, name?, description?, color? }
export async function PATCH(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const b = await request.json()
    const { id } = b
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (typeof b.name === 'string' && b.name.trim()) data.name = b.name.trim().slice(0, 60)
    if (b.description !== undefined) data.description = b.description ? String(b.description).slice(0, 300) : null
    if (/^#[0-9a-fA-F]{6}$/.test(b.color ?? '')) data.color = b.color

    const department = await db.department.update({ where: { id }, data })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    await db.auditLog.create({
      data: {
        adminId: admin.id, adminName: admin.name, action: 'org:department_update',
        targetType: 'department', targetId: id, targetLabel: department.name,
        details: 'edited', ipAddress: ip,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, department })
  } catch (error) {
    console.error('Department patch error:', error)
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 })
  }
}

// ─── DELETE /api/admin/departments?id=... ────────────────────────────────────
// Refuses when tasks are still attached — reassign them first.
export async function DELETE(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const taskCount = await db.teamTask.count({ where: { departmentId: id } })
  if (taskCount > 0) {
    return NextResponse.json({ error: `Department still has ${taskCount} task(s) — move or delete them first` }, { status: 409 })
  }

  const existing = await db.department.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Department not found' }, { status: 404 })

  await db.department.delete({ where: { id } })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
  await db.auditLog.create({
    data: {
      adminId: admin.id, adminName: admin.name, action: 'org:department_delete',
      targetType: 'department', targetId: id, targetLabel: existing.name,
      details: 'deleted', ipAddress: ip,
    },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
