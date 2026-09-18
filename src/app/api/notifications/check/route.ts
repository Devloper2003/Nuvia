import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { maybeCreatePeriodReminder } from '@/lib/reminders'

// ─── POST /api/notifications/check — period reminder engine (per user) ───────
// Body: { userId }
//
// Thin wrapper over the shared engine in src/lib/reminders.ts. Computes where
// the user is in their cycle and — when the period is expected within 2 days
// or is ≥ 2 days late — creates an in-app Notification row and pushes a
// web-push message to every subscribed device.
//
// The server-side sweep in /api/cron/reminders reuses the exact same engine,
// so reminders arrive even when the app is closed.

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        cycles: { orderBy: { startDate: 'desc' }, take: 1 },
      },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const outcome = await maybeCreatePeriodReminder(user, user.cycles[0] ?? null)

    if (!outcome.triggered) {
      if (outcome.reason === 'no-cycle-data') {
        return NextResponse.json({
          triggered: false,
          reason: 'no-cycle-data',
          message: 'Log a period to unlock reminders',
        })
      }
      if (outcome.reason === 'quiet-hours') {
        return NextResponse.json({
          triggered: false,
          reason: 'quiet-hours',
          message: 'Reminders are paused during your quiet hours',
        })
      }
      if (outcome.reason === 'disabled') {
        return NextResponse.json({
          triggered: false,
          reason: 'disabled',
          message: 'Period reminders are turned off',
        })
      }
      return NextResponse.json({
        triggered: false,
        reason: outcome.reason,
        daysUntilPeriod: outcome.daysUntilPeriod,
      })
    }

    return NextResponse.json({
      triggered: true,
      notification: { id: outcome.messageId, title: outcome.title },
      daysUntilPeriod: outcome.daysUntilPeriod,
      push: outcome.push,
    })
  } catch (error) {
    console.error('Error checking period reminders:', error)
    return NextResponse.json({ error: 'Failed to check reminders' }, { status: 500 })
  }
}
