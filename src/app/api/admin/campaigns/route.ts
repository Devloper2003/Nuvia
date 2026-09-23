import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/admin-guard'

const POSITIONS = ['top', 'feed', 'bottom', 'modal']
const AUDIENCES = ['all', 'free', 'premium']

// ─── GET /api/admin/campaigns ────────────────────────────────────────────────
// Ads & marketing campaigns (banners, promos, placements).
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaigns = await db.campaign.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] })
  return NextResponse.json({ campaigns })
}

// ─── POST /api/admin/campaigns ───────────────────────────────────────────────
// Body: { name, title, message, type?, ctaText?, ctaLink?, imageUrl?, position?, audience?, startDate?, endDate?, budget? }
export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const b = await request.json()
    const name = String(b.name ?? '').trim()
    const title = String(b.title ?? '').trim()
    const message = String(b.message ?? '').trim()
    if (!name || !title || !message) {
      return NextResponse.json({ error: 'name, title and message are required' }, { status: 400 })
    }

    const campaign = await db.campaign.create({
      data: {
        name: name.slice(0, 120),
        title: title.slice(0, 160),
        message: message.slice(0, 500),
        type: ['banner', 'promo', 'sponsored', 'announcement'].includes(b.type) ? b.type : 'banner',
        ctaText: b.ctaText ? String(b.ctaText).slice(0, 40) : null,
        ctaLink: b.ctaLink ? String(b.ctaLink).slice(0, 300) : null,
        imageUrl: b.imageUrl ? String(b.imageUrl).slice(0, 500) : null,
        position: POSITIONS.includes(b.position) ? b.position : 'top',
        audience: AUDIENCES.includes(b.audience) ? b.audience : 'all',
        status: 'draft',
        startDate: b.startDate ? new Date(b.startDate) : null,
        endDate: b.endDate ? new Date(b.endDate) : null,
        budget: typeof b.budget === 'number' && b.budget > 0 ? b.budget : null,
      },
    })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    await db.auditLog.create({
      data: {
        adminId: admin.id, adminName: admin.name, action: 'ads:create',
        targetType: 'campaign', targetId: campaign.id, targetLabel: name.slice(0, 100),
        details: `position=${campaign.position} · audience=${campaign.audience}`, ipAddress: ip,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, campaign })
  } catch (error) {
    console.error('Campaign create error:', error)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
}

// ─── PATCH /api/admin/campaigns ──────────────────────────────────────────────
// Body: { id, action?: activate | pause | complete, ...editable fields, impressions?, clicks?, spent? }
export async function PATCH(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const b = await request.json()
    const { id } = b
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const existing = await db.campaign.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    let details = ''
    const action = typeof b.action === 'string' ? b.action : ''

    if (action === 'activate') { data.status = 'active'; details = 'activated' }
    if (action === 'pause') { data.status = 'paused'; details = 'paused' }
    if (action === 'complete') { data.status = 'completed'; details = 'completed' }

    if (typeof b.name === 'string' && b.name.trim()) data.name = b.name.trim().slice(0, 120)
    if (typeof b.title === 'string' && b.title.trim()) data.title = b.title.trim().slice(0, 160)
    if (typeof b.message === 'string' && b.message.trim()) data.message = b.message.trim().slice(0, 500)
    if (['banner', 'promo', 'sponsored', 'announcement'].includes(b.type)) data.type = b.type
    if (b.ctaText !== undefined) data.ctaText = b.ctaText ? String(b.ctaText).slice(0, 40) : null
    if (b.ctaLink !== undefined) data.ctaLink = b.ctaLink ? String(b.ctaLink).slice(0, 300) : null
    if (POSITIONS.includes(b.position)) data.position = b.position
    if (AUDIENCES.includes(b.audience)) data.audience = b.audience
    if (b.startDate) data.startDate = new Date(b.startDate)
    if (b.endDate) data.endDate = new Date(b.endDate)
    if (typeof b.budget === 'number' && b.budget >= 0) data.budget = b.budget
    // Metric adjustments (synced numbers or manual corrections)
    if (typeof b.impressions === 'number') data.impressions = Math.max(0, Math.round(b.impressions))
    if (typeof b.clicks === 'number') data.clicks = Math.max(0, Math.round(b.clicks))
    if (typeof b.spent === 'number') data.spent = Math.max(0, b.spent)

    const campaign = await db.campaign.update({ where: { id }, data })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    await db.auditLog.create({
      data: {
        adminId: admin.id, adminName: admin.name, action: 'ads:update',
        targetType: 'campaign', targetId: id, targetLabel: campaign.name.slice(0, 100),
        details: details || 'edited', ipAddress: ip,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, campaign })
  } catch (error) {
    console.error('Campaign patch error:', error)
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
  }
}

// ─── DELETE /api/admin/campaigns?id=... ──────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const existing = await db.campaign.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  await db.campaign.delete({ where: { id } })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
  await db.auditLog.create({
    data: {
      adminId: admin.id, adminName: admin.name, action: 'ads:delete',
      targetType: 'campaign', targetId: id, targetLabel: existing.name.slice(0, 100),
      details: 'deleted', ipAddress: ip,
    },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
