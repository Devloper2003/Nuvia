import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getUserFromToken,
  parseCookies,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  issueSessionToken,
  toSessionUser,
  SessionUser,
} from '@/lib/auth';
import { buildCycleFields } from '@/lib/cycle-math';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    let user;
    if (userId) {
      user = await db.user.findUnique({ where: { id: userId } });
    } else {
      user = await db.user.findFirst();
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate via session token (cookie or Bearer header) — same pattern
    // as /api/auth/me. This lets the onboarding flow update the logged-in
    // user's profile without requiring an email in the body (mobile OTP users
    // have a placeholder email they don't know about).
    const cookies = parseCookies(request.headers.get('cookie'))
    const headerToken = request.headers.get('authorization')?.replace('Bearer ', '')
    const token = cookies[SESSION_COOKIE] || headerToken

    if (!token) {
      return NextResponse.json(
        { error: 'You must be signed in to update your profile.' },
        { status: 401 }
      )
    }
    const sessionUser = await getUserFromToken(token)
    if (!sessionUser) {
      return NextResponse.json(
        { error: 'Invalid or expired session. Please sign in again.' },
        { status: 401 }
      )
    }

    const body = await request.json();
    const {
      name,
      email,
      dateOfBirth,
      height,
      weight,
      cycleLength,
      periodLength,
      lastPeriodStart,
    } = body;

    // Try to persist the update to the database. On Vercel serverless with
    // ephemeral SQLite, this may fail — in that case we still issue a fresh
    // JWT with the updated fields so the frontend sees the change.
    let updatedSessionUser: SessionUser = { ...sessionUser };

    try {
      const updatedUser = await db.user.update({
        where: { id: sessionUser.id },
        data: {
          ...(name ? { name } : {}),
          ...(email ? { email } : {}),
          ...(dateOfBirth ? { dateOfBirth } : {}),
          ...(height ? { height } : {}),
          ...(weight ? { weight } : {}),
          ...(typeof cycleLength === 'number' ? { cycleLength } : {}),
          ...(typeof periodLength === 'number' ? { periodLength } : {}),
          ...(lastPeriodStart ? { lastPeriodStart } : {}),
          onboardingComplete: true,
        },
      });

      // Seed the user's first Cycle record from onboarding data so the
      // Period Tracker (history, predictions) and the Dashboard (day/phase
      // math from user.lastPeriodStart) stay consistent. Previously this
      // step only set user.lastPeriodStart, leaving the tracker's history
      // empty ("No cycle history yet") while the dashboard showed day/phase.
      // Idempotent: skips when a cycle with the same start date already
      // exists (e.g., the user logged the period in the tracker first).
      if (lastPeriodStart) {
        try {
          const existing = await db.cycle.findFirst({
            where: { userId: sessionUser.id, startDate: lastPeriodStart },
          });
          if (!existing) {
            const derived = buildCycleFields(
              lastPeriodStart,
              typeof cycleLength === 'number' ? cycleLength : sessionUser.cycleLength,
              typeof periodLength === 'number' ? periodLength : sessionUser.periodLength
            );
            await db.cycle.create({
              data: {
                userId: sessionUser.id,
                startDate: lastPeriodStart,
                ...derived,
              },
            });
          }
        } catch (seedError) {
          // Non-fatal: the tracker offers "Log your first period" as fallback.
          console.warn('Onboarding cycle seed failed:', seedError);
        }
      }

      updatedSessionUser = toSessionUser(updatedUser);
    } catch (dbError) {
      console.warn('DB update failed (likely ephemeral Vercel filesystem). Issuing fresh JWT with request-body data only.', dbError);
      // Build the updated session user from the request body + existing session.
      updatedSessionUser = {
        ...sessionUser,
        name: name ?? sessionUser.name,
        email: email ?? sessionUser.email,
        cycleLength: typeof cycleLength === 'number' ? cycleLength : sessionUser.cycleLength,
        periodLength: typeof periodLength === 'number' ? periodLength : sessionUser.periodLength,
        lastPeriodStart: lastPeriodStart ?? sessionUser.lastPeriodStart,
        onboardingComplete: true,
      };
    }

    // Re-issue a fresh session token so the embedded user info reflects the
    // update. Without this, /api/auth/me would return the stale JWT claims
    // (e.g., onboardingComplete=false) on Vercel serverless where the DB
    // lookup may fail.
    const freshToken = issueSessionToken(updatedSessionUser);
    const response = NextResponse.json({ user: updatedSessionUser, token: freshToken });
    response.cookies.set(SESSION_COOKIE, freshToken, SESSION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return NextResponse.json(
      { error: 'Failed to create/update user' },
      { status: 500 }
    );
  }
}
