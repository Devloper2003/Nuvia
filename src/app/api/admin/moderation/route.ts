import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─── Shared: validate the operator session from the Authorization header ────
async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const session = await db.adminSession.findUnique({
    where: { token },
    include: { admin: true },
  })
  if (!session || session.revoked || session.expiresAt < new Date() || !session.admin.active) {
    return null
  }
  return session.admin
}

// ─── GET /api/admin/moderation ───────────────────────────────────────────────
// Returns the moderation queue: every community post that has been reported
// (reportedCount > 0) or auto-hidden (hidden = true), plus recent audit-log
// entries so the operator sees what other moderators did.
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized — admin session required' },
        { status: 401 }
      )
    }

    const queue = await db.communityPost.findMany({
      where: {
        OR: [{ reportedCount: { gt: 0 } }, { hidden: true }],
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
        comments: { select: { id: true } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ hidden: 'desc' }, { reportedCount: 'desc' }, { updatedAt: 'desc' }],
    })

    const totalPosts = await db.communityPost.count()
    const totalComments = await db.comment.count()
    const hiddenCount = await db.communityPost.count({ where: { hidden: true } })

    const auditLog = await db.auditLog.findMany({
      where: { targetType: 'community_post' },
      orderBy: { createdAt: 'desc' },
      take: 8,
    })

    return NextResponse.json({
      queue: queue.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        category: p.category,
        likes: p.likes,
        reportedCount: p.reportedCount,
        hidden: p.hidden,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        author: p.user,
        commentCount: p._count.comments,
      })),
      stats: { totalPosts, totalComments, hiddenCount, queueSize: queue.length },
      auditLog,
      admin: { name: admin.name, email: admin.email, role: admin.role },
    })
  } catch (error) {
    console.error('Moderation queue fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to load moderation queue' },
      { status: 500 }
    )
  }
}

// ─── PATCH /api/admin/moderation ─────────────────────────────────────────────
// Body: { postId, action: 'restore' | 'dismiss' | 'delete' }
//   restore  → unhide the post and clear its reports (false-positive review)
//   dismiss  → clear the reports but KEEP the post hidden (reports were valid)
//   delete   → permanently remove the post and its comments
// Every action is written to the AuditLog trail.
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized — admin session required' },
        { status: 401 }
      )
    }

    const { postId, action } = await request.json()
    if (!postId || !['restore', 'dismiss', 'delete'].includes(action)) {
      return NextResponse.json(
        { error: 'postId and action (restore|dismiss|delete) are required' },
        { status: 400 }
      )
    }

    const post = await db.communityPost.findUnique({
      where: { id: postId },
      include: { user: { select: { name: true, email: true } } },
    })
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    let message = ''
    if (action === 'restore') {
      await db.communityPost.update({
        where: { id: postId },
        data: { hidden: false, reportedCount: 0 },
      })
      message = `"${post.title}" restored to the community feed`
    } else if (action === 'dismiss') {
      await db.communityPost.update({
        where: { id: postId },
        data: { reportedCount: 0, hidden: true },
      })
      message = `Reports dismissed — "${post.title}" stays hidden`
    } else {
      await db.comment.deleteMany({ where: { postId } })
      await db.communityPost.delete({ where: { id: postId } })
      message = `"${post.title}" permanently deleted`
    }

    await db.auditLog.create({
      data: {
        adminId: admin.id,
        adminName: admin.name,
        action: `moderation:${action}`,
        targetType: 'community_post',
        targetId: post.id,
        targetLabel: post.title,
        details: `Author: ${post.user.name ?? post.user.email} · reports: ${post.reportedCount} · wasHidden: ${post.hidden}`,
      },
    })

    return NextResponse.json({ success: true, message })
  } catch (error) {
    console.error('Moderation action error:', error)
    return NextResponse.json(
      { error: 'Failed to apply moderation action' },
      { status: 500 }
    )
  }
}
