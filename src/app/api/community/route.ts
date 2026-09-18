import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // ─── Pagination ──────────────────────────────────────────────────────────
    // When `limit` (and optionally `offset`) is provided, the route returns a
    // page envelope { posts, total, hasMore }. Without pagination params it
    // keeps the legacy behaviour of returning the full array (back-compat for
    // existing callers).
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const paginated = limitParam !== null;
    const limit = Math.min(Math.max(parseInt(limitParam ?? '10', 10) || 10, 1), 50);
    const offset = Math.max(parseInt(offsetParam ?? '0', 10) || 0, 0);

    const where: Record<string, unknown> = { hidden: false };
    if (category) {
      where.category = category;
    }

    const [posts, total] = await Promise.all([
      db.communityPost.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, avatar: true },
          },
          comments: {
            where: { hidden: false },
            include: {
              user: {
                select: { id: true, name: true, avatar: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...(paginated ? { skip: offset, take: limit } : {}),
      }),
      db.communityPost.count({ where }),
    ]);

    if (paginated) {
      return NextResponse.json({
        posts,
        total,
        hasMore: offset + posts.length < total,
        nextOffset: offset + posts.length,
      });
    }

    return NextResponse.json(posts);
  } catch (error) {
    console.error('Error fetching community posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch community posts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, title, content, category, isAnonymous } = body;

    if (!userId || !title || !content) {
      return NextResponse.json(
        { error: 'userId, title, and content are required' },
        { status: 400 }
      );
    }

    const validCategories = [
      'general',
      'pcos',
      'fertility',
      'pregnancy',
      'menopause',
      'mental_health',
    ];
    if (category && !validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    const post = await db.communityPost.create({
      data: {
        userId,
        title,
        content,
        category: category ?? 'general',
        isAnonymous: isAnonymous ?? true,
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
        comments: {
          where: { hidden: false },
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
        },
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error('Error creating community post:', error);
    return NextResponse.json(
      { error: 'Failed to create community post' },
      { status: 500 }
    );
  }
}

// ─── DELETE: remove your own post (ownership enforced) ──────────────────────
// Query: postId + userId — deletes the post and its comments only when the
// requesting user owns the post.
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    const userId = searchParams.get('userId');

    if (!postId || !userId) {
      return NextResponse.json(
        { error: 'postId and userId are required' },
        { status: 400 }
      );
    }

    const existing = await db.communityPost.findUnique({ where: { id: postId } });
    if (!existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: 'You can only delete your own posts' },
        { status: 403 }
      );
    }

    await db.comment.deleteMany({ where: { postId } });
    await db.communityPost.delete({ where: { id: postId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json(
      { error: 'Failed to delete post' },
      { status: 500 }
    );
  }
}

// ─── PATCH: like / unlike / report a post ───────────────────────────────────
// Body: { postId: string, action: 'like' | 'unlike' | 'report', reason?: string, userId?: string }
// 'report' is DE-DUPLICATED per user via the ContentReport table — repeat
// reports by the same user return 409 and never inflate reportedCount.
// reportedCount therefore mirrors the number of UNIQUE reporters and the
// post auto-hides at 3 unique reports.
export async function PATCH(request: NextRequest) {
  try {
    const { postId, action, userId, reason } = await request.json();

    if (!postId || !['like', 'unlike', 'report'].includes(action)) {
      return NextResponse.json(
        { error: 'postId and action (like|unlike|report) are required' },
        { status: 400 }
      );
    }

    const existing = await db.communityPost.findUnique({ where: { id: postId } });
    if (!existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (action === 'report') {
      if (!userId) {
        return NextResponse.json(
          { error: 'userId is required to report a post' },
          { status: 400 }
        );
      }
      if (existing.userId === userId) {
        return NextResponse.json(
          { error: 'You cannot report your own post — you can delete it instead' },
          { status: 400 }
        );
      }
      // One report per user per post — repeating the same report is a no-op.
      const alreadyReported = await db.contentReport.findUnique({
        where: { reporterId_postId: { reporterId: userId, postId } },
      });
      if (alreadyReported) {
        return NextResponse.json(
          { error: 'You have already reported this post — our moderators are on it' },
          { status: 409 }
        );
      }

      await db.contentReport.create({
        data: { reporterId: userId, postId, reason: reason?.slice(0, 500) ?? null },
      });
      const nextReports = existing.reportedCount + 1;
      const shouldHide = nextReports >= 3;
      const post = await db.communityPost.update({
        where: { id: postId },
        data: { reportedCount: nextReports, hidden: shouldHide },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          comments: {
            where: { hidden: false },
            include: { user: { select: { id: true, name: true, avatar: true } } },
          },
        },
      });
      return NextResponse.json({
        post,
        hidden: shouldHide,
        reportedCount: nextReports,
        message: shouldHide
          ? 'Post has been hidden pending moderator review'
          : 'Report recorded. Thank you for keeping the community safe.',
      });
    }

    const nextLikes =
      action === 'like'
        ? existing.likes + 1
        : Math.max(0, existing.likes - 1);

    const post = await db.communityPost.update({
      where: { id: postId },
      data: { likes: nextLikes },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        comments: {
          where: { hidden: false },
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
      },
    });

    return NextResponse.json(post);
  } catch (error) {
    console.error('Error liking post:', error);
    return NextResponse.json(
      { error: 'Failed to update like' },
      { status: 500 }
    );
  }
}
