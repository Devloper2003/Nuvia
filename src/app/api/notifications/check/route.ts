import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'

// ─── POST /api/notifications/check — period reminder engine ──────────────────
// Body: { userId }
//
// Computes where the user is in their cycle (same math as the dashboard:
// cycleDay = days-since-last-period modulo cycleLength) and — when the period
// is expected within 2 days or is ≥ 2 days late — creates an in-app
// Notification row and pushes a web-push message to every subscribed device.
//
// De-duplication: at most one period_reminder per 36h window so refreshes
// never spam the bell (or the user's lock screen).

const REMINDER_COOLDOWN_HOURS = 36

function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

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

    const latest = user.cycles[0]
    const refStart = latest?.startDate ?? user.lastPeriodStart
    if (!refStart) {
      return NextResponse.json({
        triggered: false,
        reason: 'no-cycle-data',
        message: 'Log a period to unlock reminders',
      })
    }

    const cycleLength = latest?.cycleLength ?? user.cycleLength ?? 28
    const today = startOfDay(new Date())
    const start = startOfDay(new Date(refStart))
    const daysSince = Math.floor((today.getTime() - start.getTime()) / 86_400_000)
    const daysUntilPeriod = cycleLength - daysSince

    let title: string | null = null
    let message: string | null = null

    if (daysUntilPeriod >= 0 && daysUntilPeriod <= 2) {
      title =
        daysUntilPeriod === 0
          ? '🌸 Your period is expected today'
          : `🌸 Period expected in ${daysUntilPeriod} day${daysUntilPeriod === 1 ? '' : 's'}`
      message = `Based on your ${cycleLength}-day cycle, your period is likely to start${
        daysUntilPeriod === 0 ? ' today' : ` on ${new Date(today.getTime() + daysUntilPeriod * 86_400_000).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`
      }. Consider stocking up on supplies and planning a lighter schedule.`
    } else if (daysUntilPeriod < 0 && -daysUntilPeriod >= 2) {
      const daysLate = -daysUntilPeriod
      title = `⏰ Period is ${daysLate} day${daysLate === 1 ? '' : 's'} late`
      message = `Your usual ${cycleLength}-day cycle has run over. Stress, travel and sleep can shift timing — log today as cycle day 1 when it arrives, and reach out to a doctor if delays become a pattern.`
    }

    if (!title || !message) {
      return NextResponse.json({
        triggered: false,
        reason: 'not-due',
        daysUntilPeriod,
      })
    }

    // Cooldown, two layers:
    //   a) identical reminder (same title) at most once per 36h
    //   b) at most one period_reminder of ANY kind per 24h (covers the
    //      seed route's reminder variants, so the bell never floods)
    const titleCutoff = new Date(Date.now() - REMINDER_COOLDOWN_HOURS * 3_600_000)
    const dayCutoff = new Date(Date.now() - 24 * 3_600_000)
    const [sameReminder, anyRecentReminder] = await Promise.all([
      db.notification.findFirst({
        where: { userId, type: 'period_reminder', title, createdAt: { gte: titleCutoff } },
      }),
      db.notification.findFirst({
        where: { userId, type: 'period_reminder', createdAt: { gte: dayCutoff } },
      }),
    ])
    if (sameReminder || anyRecentReminder) {
      return NextResponse.json({
        triggered: false,
        reason: 'cooldown',
        daysUntilPeriod,
      })
    }

    const notification = await db.notification.create({
      data: { userId, title, message, type: 'period_reminder' },
    })

    // Fan out to every subscribed browser/device
    const push = await sendPushToUser(userId, {
      title,
      body: message,
      tag: 'chandracycle-period-reminder',
      url: '/dashboard',
      type: 'period_reminder',
    })

    return NextResponse.json({
      triggered: true,
      notification,
      daysUntilPeriod,
      push,
    })
  } catch (error) {
    console.error('Error checking period reminders:', error)
    return NextResponse.json({ error: 'Failed to check reminders' }, { status: 500 })
  }
}
