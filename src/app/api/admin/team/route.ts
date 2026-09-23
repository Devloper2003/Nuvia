import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { hashPassword } from '@/lib/auth'

const ROLES = ['super_admin', 'admin', 'moderator']

// ─── GET /api/admin/team ─────────────────────────────────────────────────────
// Internal team roster: every operator with live-session + task counts.
// ?detail=<id> → operator dossier: member + assigned tasks + their recent
// audit actions (powers the HQ member drawer).
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const detailId = new URL(request.url).searchParams.get('detail')
  if (detailId) {
    const member = await db.adminUser.findUnique({
      where: { id: detailId },
      select: {
        id: true, email: true, name: true, role: true, department: true,
        active: true, lastLoginAt: true, createdAt: true,
      },
    })
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    const [tasks, audit, liveSessions] = await Promise.all([
      db.teamTask.findMany({
        where: { assigneeId: detailId },
        orderBy: [{ status: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
        include: { department: { select: { name: true, key: true, color: true } } },
      }),
      db.auditLog.findMany({
        where: { adminId: detailId },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      db.adminSession.count({ where: { adminId: detailId, revoked: false, expiresAt: { gt: new Date() } } }),
    ])

    return NextResponse.json({ member, tasks, audit, liveSessions })
  }

  const members = await db.adminUser.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, email: true, name: true, role: true, department: true,
      active: true, lastLoginAt: true, createdAt: true,
      _count: { select: { sessions: true, assignedTasks: true, auditLogs: true } },
    },
  })

  const liveSessions = await db.adminSession.groupBy({
    by: ['adminId'],
    where: { revoked: false, expiresAt: { gt: new Date() } },
    _count: { _all: true },
  })
  const liveMap = new Map(liveSessions.map((s) => [s.adminId, s._count._all]))

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id, email: m.email, name: m.name, role: m.role, department: m.department,
      active: m.active, lastLoginAt: m.lastLoginAt, createdAt: m.createdAt,
      liveSessions: liveMap.get(m.id) ?? 0,
      openTasks: m._count.assignedTasks, auditActions: m._count.auditLogs,
    })),
  })
}

// ─── POST /api/admin/team ────────────────────────────────────────────────────
// Invite a team member. Body: { email, name, role, department?, password? }
// Password auto-generates when omitted and is returned ONCE for handoff.
export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const name = String(body.name ?? '').trim()
    const role = ROLES.includes(body.role) ? body.role : 'moderator'
    const department = body.department ? String(body.department).slice(0, 60) : null

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    // Only a super_admin can mint another super_admin.
    if (role === 'super_admin' && admin.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only a super_admin can create super_admins' }, { status: 403 })
    }

    const existing = await db.adminUser.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: 'That operator already exists' }, { status: 409 })

    const password = typeof body.password === 'string' && body.password.length >= 8
      ? body.password
      : `nv-${randomBytes(6).toString('hex')}`

    const member = await db.adminUser.create({
      data: { email, name, role, department, passwordHash: await hashPassword(password) },
    })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    await db.auditLog.create({
      data: {
        adminId: admin.id, adminName: admin.name, action: 'team:invite',
        targetType: 'operator', targetId: member.id, targetLabel: email,
        details: `role=${role}${department ? ` · dept=${department}` : ''}`, ipAddress: ip,
      },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      member: { id: member.id, email: member.email, name: member.name, role: member.role, department: member.department },
      // One-time credentials handoff — never returned again.
      credentials: { email, password },
    })
  } catch (error) {
    console.error('Team invite error:', error)
    return NextResponse.json({ error: 'Failed to invite member' }, { status: 500 })
  }
}

// ─── PATCH /api/admin/team ───────────────────────────────────────────────────
// Body: { id, action: activate | deactivate | set_role | reset_password | set_department, value? }
export async function PATCH(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { id, action } = body
    if (!id || !action) return NextResponse.json({ error: 'id and action are required' }, { status: 400 })

    const member = await db.adminUser.findUnique({ where: { id } })
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Guard rails: never lock yourself out.
    if (member.id === admin.id && ['deactivate', 'set_role'].includes(action)) {
      return NextResponse.json({ error: 'You cannot change your own role or deactivate yourself' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    let details = ''

    switch (action) {
      case 'activate':
      case 'deactivate': {
        const active = action === 'activate'
        await db.adminUser.update({ where: { id }, data: { active } })
        if (!active) {
          // Kill their live sessions so deactivation is immediate.
          await db.adminSession.updateMany({ where: { adminId: id, revoked: false }, data: { revoked: true, revokedAt: new Date(), revokedReason: 'member deactivated' } })
        }
        details = `${member.email} ${active ? 'activated' : 'deactivated'}`
        break
      }
      case 'set_role': {
        const role = ROLES.includes(body.value) ? body.value : null
        if (!role) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
        if (role === 'super_admin' && admin.role !== 'super_admin') {
          return NextResponse.json({ error: 'Only a super_admin can grant super_admin' }, { status: 403 })
        }
        await db.adminUser.update({ where: { id }, data: { role } })
        details = `${member.email} role → ${role}`
        break
      }
      case 'set_department': {
        const department = body.value ? String(body.value).slice(0, 60) : null
        await db.adminUser.update({ where: { id }, data: { department } })
        details = `${member.email} department → ${department ?? 'none'}`
        break
      }
      case 'rename': {
        const name = String(body.value ?? '').trim()
        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
        await db.adminUser.update({ where: { id }, data: { name: name.slice(0, 80) } })
        details = `${member.email} renamed → ${name.slice(0, 80)}`
        break
      }
      case 'reset_password': {
        const password = typeof body.value === 'string' && body.value.length >= 8
          ? body.value
          : `nv-${randomBytes(6).toString('hex')}`
        await db.adminUser.update({ where: { id }, data: { passwordHash: await hashPassword(password) } })
        await db.adminSession.updateMany({ where: { adminId: id, revoked: false }, data: { revoked: true, revokedAt: new Date(), revokedReason: 'password reset' } })
        await db.auditLog.create({
          data: {
            adminId: admin.id, adminName: admin.name, action: 'team:reset_password',
            targetType: 'operator', targetId: id, targetLabel: member.email,
            details: 'sessions revoked + password rotated', ipAddress: ip,
          },
        }).catch(() => {})
        return NextResponse.json({ success: true, credentials: { email: member.email, password } })
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    await db.auditLog.create({
      data: {
        adminId: admin.id, adminName: admin.name, action: `team:${action}`,
        targetType: 'operator', targetId: id, targetLabel: member.email,
        details, ipAddress: ip,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, message: details })
  } catch (error) {
    console.error('Team patch error:', error)
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
  }
}

// ─── DELETE /api/admin/team?id=... ───────────────────────────────────────────
// Permanently remove an operator. Sessions cascade away, audit entries keep
// history (adminId set null), their open tasks become unassigned.
export async function DELETE(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  if (id === admin.id) return NextResponse.json({ error: 'You cannot remove your own account' }, { status: 400 })

  const member = await db.adminUser.findUnique({ where: { id } })
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  const openTasks = await db.teamTask.count({ where: { assigneeId: id, status: { not: 'done' } } })

  await db.adminUser.delete({ where: { id } })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
  await db.auditLog.create({
    data: {
      adminId: admin.id, adminName: admin.name, action: 'team:remove',
      targetType: 'operator', targetId: id, targetLabel: member.email,
      details: `removed · role=${member.role}${openTasks > 0 ? ` · ${openTasks} open task(s) unassigned` : ''}`,
      ipAddress: ip,
    },
  }).catch(() => {})

  return NextResponse.json({ success: true, message: `${member.email} removed from the team` })
}
