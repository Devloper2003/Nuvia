import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/admin-guard'

// ─── GET /api/admin/settings ─────────────────────────────────────────────────
// HQ app configuration — every SiteSetting KV (feature flags, messaging, etc.)
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await db.siteSetting.findMany({ orderBy: { key: 'asc' } })
  return NextResponse.json({ settings })
}

// ─── PUT /api/admin/settings ─────────────────────────────────────────────────
// Body: { entries: { [key: string]: string } } — upsert each, audit-logged.
export async function PUT(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const entries = body?.entries as Record<string, unknown> | undefined
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
      return NextResponse.json({ error: 'entries object is required' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    const changed: string[] = []

    for (const [key, value] of Object.entries(entries)) {
      if (!/^[a-z0-9_.-]{2,60}$/i.test(key)) continue
      const strValue = String(value ?? '').slice(0, 2000)
      await db.siteSetting.upsert({
        where: { key },
        update: { value: strValue },
        create: { key, value: strValue },
      })
      changed.push(key)
    }

    if (changed.length) {
      await db.auditLog.create({
        data: {
          adminId: admin.id, adminName: admin.name, action: 'config:update',
          targetType: 'settings', targetId: null, targetLabel: changed.join(', ').slice(0, 200),
          details: `updated ${changed.length} setting(s)`, ipAddress: ip,
        },
      }).catch(() => {})
    }

    const settings = await db.siteSetting.findMany({ orderBy: { key: 'asc' } })
    return NextResponse.json({ success: true, changed, settings })
  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
