import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/admin-guard'

// ─── GET /api/admin/audit ────────────────────────────────────────────────────
// Basement audit-trail viewer. SUPER_ADMIN only. Returns the latest audit
// entries (every moderation + basement action is logged here).

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const take = Math.min(200, Math.max(1, parseInt(searchParams.get('take') ?? '80', 10) || 80))
    const q = (searchParams.get('q') ?? '').trim()

    const entries = await db.auditLog.findMany({
      where: q
        ? {
            OR: [
              { action: { contains: q, mode: 'insensitive' } },
              { targetLabel: { contains: q, mode: 'insensitive' } },
              { adminName: { contains: q, mode: 'insensitive' } },
              { details: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take,
    })

    const total = await db.auditLog.count()

    return NextResponse.json({ entries, total })
  } catch (error) {
    console.error('Basement audit error:', error)
    return NextResponse.json({ error: 'Failed to load audit trail' }, { status: 500 })
  }
}
