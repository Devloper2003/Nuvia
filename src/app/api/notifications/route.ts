import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const notifications = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications
// Body: { userId } (or ?userId= query) — clears all READ notifications for the user.
// Unread notifications are never deleted, so nothing important is lost.
export async function DELETE(request: NextRequest) {
  try {
    let userId: string | null = null;
    try {
      const body = await request.json();
      userId = typeof body?.userId === 'string' ? body.userId : null;
    } catch {
      // no/invalid JSON body — fall back to query string
    }
    if (!userId) {
      userId = request.nextUrl.searchParams.get('userId');
    }
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const deleted = await db.notification.deleteMany({
      where: { userId, read: true },
    });

    return NextResponse.json({ ok: true, deleted: deleted.count });
  } catch (error) {
    console.error('Error clearing read notifications:', error);
    return NextResponse.json(
      { error: 'Failed to clear notifications' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, title, message, type } = body;

    if (!userId || !title || !message) {
      return NextResponse.json(
        { error: 'userId, title, and message are required' },
        { status: 400 }
      );
    }

    const validTypes = [
      'period_reminder',
      'medication',
      'appointment',
      'insight',
      'community',
    ];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const notification = await db.notification.create({
      data: {
        userId,
        title,
        message,
        type: type ?? 'insight',
        read: false,
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}
