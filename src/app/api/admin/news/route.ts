import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/admin-guard'

const CATEGORIES = ['update', 'feature', 'health', 'company', 'press']

// ─── GET /api/admin/news ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const posts = await db.newsPost.findMany({ orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }] })
  return NextResponse.json({ posts })
}

// ─── POST /api/admin/news ────────────────────────────────────────────────────
// Body: { title, excerpt?, body, category?, coverUrl?, pinned?, publish? }
export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const b = await request.json()
    const title = String(b.title ?? '').trim()
    const bodyText = String(b.body ?? '').trim()
    if (!title || !bodyText) return NextResponse.json({ error: 'Title and body are required' }, { status: 400 })

    const publish = b.publish === true
    const post = await db.newsPost.create({
      data: {
        title: title.slice(0, 200),
        excerpt: b.excerpt ? String(b.excerpt).slice(0, 300) : bodyText.slice(0, 180),
        body: bodyText.slice(0, 20000),
        category: CATEGORIES.includes(b.category) ? b.category : 'update',
        coverUrl: b.coverUrl ? String(b.coverUrl).slice(0, 500) : null,
        pinned: b.pinned === true,
        published: publish,
        publishedAt: publish ? new Date() : null,
        authorName: admin.name,
      },
    })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    await db.auditLog.create({
      data: {
        adminId: admin.id, adminName: admin.name, action: 'news:create',
        targetType: 'news', targetId: post.id, targetLabel: title.slice(0, 100),
        details: publish ? 'created + published' : 'created (draft)', ipAddress: ip,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error('News create error:', error)
    return NextResponse.json({ error: 'Failed to create news post' }, { status: 500 })
  }
}

// ─── PATCH /api/admin/news ───────────────────────────────────────────────────
// Body: { id, action?: publish | unpublish | pin | unpin, title?, excerpt?, body?, category? }
export async function PATCH(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const b = await request.json()
    const { id } = b
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const existing = await db.newsPost.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'News post not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    let details = ''
    const action = typeof b.action === 'string' ? b.action : ''

    if (action === 'publish' || action === 'unpin' || action === 'pin' || action === 'unpublish') {
      if (action === 'publish') { data.published = true; data.publishedAt = existing.publishedAt ?? new Date(); details = 'published' }
      if (action === 'unpublish') { data.published = false; details = 'unpublished' }
      if (action === 'pin') { data.pinned = true; details = 'pinned' }
      if (action === 'unpin') { data.pinned = false; details = 'unpinned' }
    }
    if (typeof b.title === 'string' && b.title.trim()) { data.title = b.title.trim().slice(0, 200); details += `${details ? ' · ' : ''}title edited` }
    if (typeof b.excerpt === 'string') data.excerpt = b.excerpt.slice(0, 300)
    if (typeof b.body === 'string' && b.body.trim()) { data.body = b.body.slice(0, 20000); details += `${details ? ' · ' : ''}body edited` }
    if (CATEGORIES.includes(b.category)) data.category = b.category

    const post = await db.newsPost.update({ where: { id }, data })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    await db.auditLog.create({
      data: {
        adminId: admin.id, adminName: admin.name, action: 'news:update',
        targetType: 'news', targetId: id, targetLabel: post.title.slice(0, 100),
        details: details || 'edited', ipAddress: ip,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error('News patch error:', error)
    return NextResponse.json({ error: 'Failed to update news post' }, { status: 500 })
  }
}

// ─── DELETE /api/admin/news?id=... ───────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const existing = await db.newsPost.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'News post not found' }, { status: 404 })

  await db.newsPost.delete({ where: { id } })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
  await db.auditLog.create({
    data: {
      adminId: admin.id, adminName: admin.name, action: 'news:delete',
      targetType: 'news', targetId: id, targetLabel: existing.title.slice(0, 100),
      details: 'deleted', ipAddress: ip,
    },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
