import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const where: Record<string, unknown> = {};
    if (category) {
      where.category = category;
    }

    const posts = await db.communityPost.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

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

// ─── PATCH: like / unlike a post (persists the like count) ──────────────────
// Body: { postId: string, action: 'like' | 'unlike' }
export async function PATCH(request: NextRequest) {
  try {
    const { postId, action } = await request.json();

    if (!postId || !['like', 'unlike'].includes(action)) {
      return NextResponse.json(
        { error: 'postId and action (like|unlike) are required' },
        { status: 400 }
      );
    }

    const existing = await db.communityPost.findUnique({ where: { id: postId } });
    if (!existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
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
