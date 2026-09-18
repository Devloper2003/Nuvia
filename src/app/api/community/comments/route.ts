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
