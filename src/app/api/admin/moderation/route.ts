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
// (reportedCount > 0) or auto-hidden (hidden = true), every hidden comment,
// plus recent audit-log entries so the operator sees what other moderators did.
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

    const commentQueue = await db.comment.findMany({
      where: {
        OR: [{ hidden: true }, { reportedCount: { gt: 0 } }],
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        post: { select: { id: true, title: true } },
      },
      orderBy: [{ hidden: 'desc' }, { reportedCount: 'desc' }, { createdAt: 'desc' }],
    })

    const totalPosts = await db.communityPost.count()
    const totalComments = await db.comment.count()
    const hiddenCount = await db.communityPost.count({ where: { hidden: true } })
    const hiddenComments = await db.comment.count({ where: { hidden: true } })
    const reportedComments = await db.comment.count({
      where: { reportedCount: { gt: 0 } },
    })

    const auditLog = await db.auditLog.findMany({
      where: { targetType: { in: ['community_post', 'community_comment'] } },
      orderBy: { createdAt: 'desc' },
      take: 12,
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
      commentQueue: commentQueue.map((c) => ({
        id: c.id,
        content: c.content,
        reportedCount: c.reportedCount,
        hidden: c.hidden,
        createdAt: c.createdAt,
        author: c.user,
        post: c.post,
      })),
      stats: {
        totalPosts,
        totalComments,
        hiddenCount,
        hiddenComments,
        reportedComments,
        queueSize: queue.length,
      },
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
// Body (single):
//   { targetType: 'post',    id, action: 'restore' | 'dismiss' | 'delete' }
//   { targetType: 'comment', id, action: 'restore' | 'delete' }
// Body (bulk):
//   { targetType: 'post' | 'comment', ids: string[], action: '...' }
// Legacy body still accepted: { postId, action }.
//   post restore  → unhide the post and clear its reports (false-positive review)
//   post dismiss  → clear the reports but KEEP the post hidden (reports were valid)
//   post delete   → permanently remove the post and its comments
//   comment restore → unhide a moderator-hidden comment
//   comment delete  → permanently remove the comment
// Every action is written to the AuditLog trail (one row per target).
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized — admin session required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { targetType = 'post', action, ids } = body
    const id = body.id ?? body.postId
    const validActions = ['restore', 'dismiss', 'delete']

    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: 'action (restore|dismiss|delete) is required' },
        { status: 400 }
      )
    }
    if (targetType !== 'post' && targetType !== 'comment') {
      return NextResponse.json(
        { error: 'targetType must be "post" or "comment"' },
        { status: 400 }
      )
    }

    const targetIds: string[] = Array.isArray(ids)
      ? ids.filter((x: unknown): x is string => typeof x === 'string')
      : [id]
    if (targetIds.length === 0 || targetIds.some((x) => !x)) {
      return NextResponse.json(
        { error: 'id (or ids array) is required' },
        { status: 400 }
      )
    }
    if (targetIds.length > 50) {
      return NextResponse.json(
        { error: 'Bulk actions are limited to 50 items at a time' },
        { status: 400 }
      )
    }

    const results = { processed: 0, missing: 0 }
    for (const targetId of targetIds) {
      if (targetType === 'post') {
        const post = await db.communityPost.findUnique({
          where: { id: targetId },
          include: { user: { select: { name: true, email: true } } },
        })
        if (!post) {
          results.missing++
          continue
        }
        let message = ''
        if (action === 'restore') {
          await db.communityPost.update({
            where: { id: targetId },
            data: { hidden: false, reportedCount: 0 },
          })
          // Clear the individual reports so users can re-report if it happens again
          await db.contentReport.deleteMany({ where: { postId: targetId } })
          message = `"${post.title}" restored to the community feed`
        } else if (action === 'dismiss') {
          await db.communityPost.update({
            where: { id: targetId },
            data: { reportedCount: 0, hidden: true },
          })
          await db.contentReport.deleteMany({ where: { postId: targetId } })
          message = `Reports dismissed — "${post.title}" stays hidden`
        } else {
          await db.comment.deleteMany({ where: { postId: targetId } })
          await db.communityPost.delete({ where: { id: targetId } })
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
        results.processed++
      } else {
        const comment = await db.comment.findUnique({
          where: { id: targetId },
          include: {
            user: { select: { name: true, email: true } },
            post: { select: { id: true, title: true } },
          },
        })
        if (!comment) {
          results.missing++
          continue
        }
        if (action === 'restore') {
          await db.comment.update({
            where: { id: targetId },
            data: { hidden: false, reportedCount: 0 },
          })
          await db.contentReport.deleteMany({ where: { commentId: targetId } })
        } else if (action === 'dismiss') {
          // Reports were false positives — clear them but keep a visible comment visible.
          await db.comment.update({
            where: { id: targetId },
            data: { reportedCount: 0 },
          })
          await db.contentReport.deleteMany({ where: { commentId: targetId } })
        } else {
          await db.comment.delete({ where: { id: targetId } })
        }
        await db.auditLog.create({
          data: {
            adminId: admin.id,
            adminName: admin.name,
            action: `moderation:${action}`,
            targetType: 'community_comment',
            targetId: comment.id,
            targetLabel: comment.content.slice(0, 80),
            details: `Author: ${comment.user.name ?? comment.user.email} · post: "${comment.post.title}" · reports: ${comment.reportedCount} · wasHidden: ${comment.hidden} · action: ${action}`,
          },
        })
        results.processed++
      }
    }

    const message =
      targetIds.length === 1
        ? `${targetType === 'post' ? 'Post' : 'Comment'} ${action === 'restore' ? 'restored' : action === 'dismiss' ? 'dismissed' : 'deleted'} — ${results.processed} processed`
        : `Bulk ${action}: ${results.processed} ${targetType}(s) processed${results.missing ? `, ${results.missing} not found` : ''}`

    return NextResponse.json({ success: true, message, ...results })
  } catch (error) {
    console.error('Moderation action error:', error)
    return NextResponse.json(
      { error: 'Failed to apply moderation action' },
      { status: 500 }
    )
  }
}
