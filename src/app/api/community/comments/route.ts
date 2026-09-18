import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── GET /api/community/comments?postId=xxx ──────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }

    const comments = await db.comment.findMany({
      where: { postId, hidden: false },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

// ─── POST /api/community/comments ────────────────────────────────────────────
// Body: { postId, userId, content, isAnonymous? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId, userId, content, isAnonymous } = body;

    if (!postId || !userId || !content?.trim()) {
      return NextResponse.json(
        { error: 'postId, userId, and content are required' },
        { status: 400 }
      );
    }

    const post = await db.communityPost.findUnique({ where: { id: postId } });
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const comment = await db.comment.create({
      data: {
        postId,
        userId,
        content: content.trim(),
        isAnonymous: isAnonymous ?? true,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/community/comments ───────────────────────────────────────────
// Body: { commentId, action: 'report', reason?: string, userId?: string }
// Reports are DE-DUPLICATED per user via the ContentReport table — a repeat
// report by the same user returns 409 without inflating the count. The
// comment auto-hides at 3 UNIQUE reports, mirroring post semantics.
export async function PATCH(request: NextRequest) {
  try {
    const { commentId, action, userId, reason } = await request.json();

    if (!commentId || action !== 'report') {
      return NextResponse.json(
        { error: 'commentId and action "report" are required' },
        { status: 400 }
      );
    }

    const existing = await db.comment.findUnique({ where: { id: commentId } });
    if (!existing) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required to report a comment' },
        { status: 400 }
      );
    }
    if (existing.userId === userId) {
      return NextResponse.json(
        { error: 'You cannot report your own comment' },
        { status: 400 }
      );
    }
    // One report per user per comment — repeating is a no-op.
    const alreadyReported = await db.contentReport.findUnique({
      where: { reporterId_commentId: { reporterId: userId, commentId } },
    });
    if (alreadyReported) {
      return NextResponse.json(
        { error: 'You have already reported this comment — our moderators are on it' },
        { status: 409 }
      );
    }

    await db.contentReport.create({
      data: { reporterId: userId, commentId, reason: reason?.slice(0, 500) ?? null },
    });
    const nextReports = existing.reportedCount + 1;
    const shouldHide = nextReports >= 3;

    const comment = await db.comment.update({
      where: { id: commentId },
      data: { reportedCount: nextReports, hidden: shouldHide },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    return NextResponse.json({
      comment,
      hidden: shouldHide,
      reportedCount: nextReports,
      message: shouldHide
        ? 'Comment has been hidden pending moderator review'
        : 'Report recorded. Thank you for keeping the community safe.',
    });
  } catch (error) {
    console.error('Error reporting comment:', error);
    return NextResponse.json(
      { error: 'Failed to report comment' },
      { status: 500 }
    );
  }
}
