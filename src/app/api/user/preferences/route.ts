import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromToken, parseCookies, SESSION_COOKIE } from '@/lib/auth'

// ─── /api/user/preferences — per-user reminder preferences ───────────────────
//
// GET   → current { remindersEnabled, quietStart, quietEnd } (+ quietNow flag)
// PATCH → update any subset: { remindersEnabled?, quietStart?, quietEnd? }
//         quietStart/quietEnd: integer hour 0–23 or null to clear the window.
//
// Auth: session token via cookie or Bearer header (same as /api/auth/me).
// The reminder engine (src/lib/reminders.ts) reads these fields both in the
// per-user check and the server-side sweep, so a change here applies instantly.

function parseToken(request: NextRequest): string | null {
  const cookies = parseCookies(request.headers.get('cookie'))
  const headerToken = request.headers.get('authorization')?.replace('Bearer ', '')
  return cookies[SESSION_COOKIE] || headerToken || null
}

function validHour(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 23
}

export async function GET(request: NextRequest) {
  try {
    const token = parseToken(request)
    if (!token) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    const sessionUser = await getUserFromToken(token)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, remindersEnabled: true, quietStart: true, quietEnd: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Lazy import avoids pulling the push client into this hot path.
    const { isQuietHour } = await import('@/lib/reminders')
    return NextResponse.json({
      remindersEnabled: user.remindersEnabled,
      quietStart: user.quietStart,
      quietEnd: user.quietEnd,
      quietNow: isQuietHour(new Date(), user.quietStart, user.quietEnd),
    })
  } catch (error) {
    console.error('Preferences GET error:', error)
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = parseToken(request)
    if (!token) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    const sessionUser = await getUserFromToken(token)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 })
    }

    const body = await request.json()
    const { remindersEnabled, quietStart, quietEnd } = body ?? {}

    // Validation: booleans stay booleans, hours must be 0–23 integers or null.
    if (remindersEnabled !== undefined && typeof remindersEnabled !== 'boolean') {
      return NextResponse.json({ error: 'remindersEnabled must be a boolean' }, { status: 400 })
    }
    if (
      quietStart !== undefined &&
      quietStart !== null &&
      !validHour(quietStart)
    ) {
      return NextResponse.json({ error: 'quietStart must be an integer 0–23 or null' }, { status: 400 })
    }
    if (
      quietEnd !== undefined &&
      quietEnd !== null &&
      !validHour(quietEnd)
    ) {
      return NextResponse.json({ error: 'quietEnd must be an integer 0–23 or null' }, { status: 400 })
    }
    if (quietStart === null || quietEnd === null) {
      // Clearing one half of the window clears the whole window.
      if (quietStart === null && quietEnd !== undefined && quietEnd !== null) {
        return NextResponse.json({ error: 'Set quietStart too, or clear both ends' }, { status: 400 })
      }
    }

    const data: { remindersEnabled?: boolean; quietStart?: number | null; quietEnd?: number | null } = {}
    if (typeof remindersEnabled === 'boolean') data.remindersEnabled = remindersEnabled
    if (quietStart !== undefined) data.quietStart = quietStart
    if (quietEnd !== undefined) data.quietEnd = quietEnd

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    // Keep the window coherent: writing only one end when the other is unset
    // is allowed (client sends both), but a window needs both ends to engage.
    const updated = await db.user.update({
      where: { id: sessionUser.id },
      data,
      select: { id: true, remindersEnabled: true, quietStart: true, quietEnd: true },
    })

    const { isQuietHour } = await import('@/lib/reminders')
    return NextResponse.json({
      ok: true,
      preferences: {
        remindersEnabled: updated.remindersEnabled,
        quietStart: updated.quietStart,
        quietEnd: updated.quietEnd,
        quietNow: isQuietHour(new Date(), updated.quietStart, updated.quietEnd),
      },
    })
  } catch (error) {
    console.error('Preferences PATCH error:', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}
