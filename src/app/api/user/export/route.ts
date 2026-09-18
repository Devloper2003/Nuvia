import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getUserFromToken,
  parseCookies,
  SESSION_COOKIE,
} from '@/lib/auth';

// GET /api/user/export — full data export for the signed-in user (GDPR-style
// "right to portability"). Returns every record the user owns as JSON with a
// schema-version header so future tooling can parse historical exports.
export async function GET(request: NextRequest) {
  try {
    const cookies = parseCookies(request.headers.get('cookie'));
    const headerToken = request.headers
      .get('authorization')
      ?.replace('Bearer ', '');
    const token = cookies[SESSION_COOKIE] || headerToken;
    if (!token) {
      return NextResponse.json(
        { error: 'You must be signed in to export your data.' },
        { status: 401 }
      );
    }
    const sessionUser = await getUserFromToken(token);
    if (!sessionUser) {
      return NextResponse.json(
        { error: 'Invalid or expired session. Please sign in again.' },
        { status: 401 }
      );
    }
    const userId = sessionUser.id;

    // AuthSession/AdminSession are operator-owned and deliberately excluded.
    const [
      profile,
      cycles,
      moods,
      sleeps,
      waters,
      symptoms,
      chatMessages,
      communityPosts,
      communityComments,
      notifications,
      appointments,
    ] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          dateOfBirth: true,
          height: true,
          weight: true,
          cycleLength: true,
          periodLength: true,
          lastPeriodStart: true,
          onboardingComplete: true,
          remindersEnabled: true,
          quietStart: true,
          quietEnd: true,
          provider: true,
          createdAt: true,
        },
      }),
      db.cycle.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
      db.moodEntry.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      db.sleepEntry.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      db.waterEntry.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      db.symptomEntry.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      db.chatMessage.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      db.communityPost.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      db.comment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      db.appointment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const payload = {
      $schema: 'chandracycle-data-export',
      $version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      counts: {
        cycles: cycles.length,
        moods: moods.length,
        sleeps: sleeps.length,
        waters: waters.length,
        symptoms: symptoms.length,
        chatMessages: chatMessages.length,
        communityPosts: communityPosts.length,
        communityComments: communityComments.length,
        notifications: notifications.length,
        appointments: appointments.length,
      },
      data: {
        cycles,
        moods,
        sleeps,
        waters,
        symptoms,
        chatMessages,
        communityPosts,
        communityComments,
        notifications,
        appointments,
      },
    };

    const filename = `chandracycle-export-${new Date().toISOString().split('T')[0]}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error exporting user data:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
