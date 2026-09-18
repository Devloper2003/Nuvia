import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'

// ─── Period reminder engine (shared core) ────────────────────────────────────
// One source of truth for the reminder maths + anti-spam cooldowns, used by:
//   • /api/notifications/check  → per-user check when the app is open
//   • /api/cron/reminders       → server-side sweep so reminders arrive even
//                                 when the app is closed (via web-push)
//
// Cycle math (same as dashboard): cycleDay = days-since-last-period, wrapped
// modulo cycleLength. A reminder fires when the period is expected within 2
// days (0–2) or is ≥ 2 days late.

export const REMINDER_COOLDOWN_HOURS = 36

function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

export interface ReminderDecision {
  title: string
  message: string
  daysUntilPeriod: number
  cycleLength: number
}

export type ReminderSkipReason = 'no-cycle-data' | 'not-due' | 'cooldown' | 'quiet-hours' | 'disabled'

export interface ReminderOutcome {
  triggered: boolean
  reason?: ReminderSkipReason
  daysUntilPeriod?: number
  title?: string
  messageId?: string
  push?: { sent: number; pruned: number; failed: number; total: number }
}

interface CycleLike {
  startDate: Date | string
  cycleLength: number
}

interface UserLike {
  id: string
  cycleLength: number
  lastPeriodStart: Date | string | null
  remindersEnabled?: boolean
  quietStart?: number | null
  quietEnd?: number | null
}

/**
 * Is `date` (default now) inside the user's quiet-hours window?
 * Window semantics: [start, end) in local server time, wrap-around safe
 * (e.g. 22 → 7 covers 22:00–06:59). start===end (or either null) = no window.
 */
export function isQuietHour(date: Date, start?: number | null, end?: number | null): boolean {
  if (start == null || end == null) return false
  if (!Number.isInteger(start) || !Number.isInteger(end)) return false
  if (start < 0 || start > 23 || end < 0 || end > 23) return false
  if (start === end) return false
  const h = date.getHours()
  if (start < end) return h >= start && h < end
  return h >= start || h < end
}

/** Decide whether a user is due a reminder right now (pure, no side effects). */
export function evaluatePeriodReminder(
  user: UserLike,
  latestCycle: CycleLike | null
): ReminderDecision | null {
  const refStart = latestCycle?.startDate ?? user.lastPeriodStart
  if (!refStart) return null

  const cycleLength = latestCycle?.cycleLength ?? user.cycleLength ?? 28
  const today = startOfDay(new Date())
  const start = startOfDay(new Date(refStart))
  const daysSince = Math.floor((today.getTime() - start.getTime()) / 86_400_000)
  const daysUntilPeriod = cycleLength - daysSince

  if (daysUntilPeriod >= 0 && daysUntilPeriod <= 2) {
    const title =
      daysUntilPeriod === 0
        ? '🌸 Your period is expected today'
        : `🌸 Period expected in ${daysUntilPeriod} day${daysUntilPeriod === 1 ? '' : 's'}`
    const message = `Based on your ${cycleLength}-day cycle, your period is likely to start${
      daysUntilPeriod === 0
        ? ' today'
        : ` on ${new Date(today.getTime() + daysUntilPeriod * 86_400_000).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`
    }. Consider stocking up on supplies and planning a lighter schedule.`
    return { title, message, daysUntilPeriod, cycleLength }
  }

  if (daysUntilPeriod < 0 && -daysUntilPeriod >= 2) {
    const daysLate = -daysUntilPeriod
    return {
      title: `⏰ Period is ${daysLate} day${daysLate === 1 ? '' : 's'} late`,
      message: `Your usual ${cycleLength}-day cycle has run over. Stress, travel and sleep can shift timing — log today as cycle day 1 when it arrives, and reach out to a doctor if delays become a pattern.`,
      daysUntilPeriod,
      cycleLength,
    }
  }

  return null
}

/**
 * Full per-user pipeline: evaluate → cooldown → create Notification → push.
 * Two-layer cooldown (unchanged semantics):
 *   a) identical reminder (same title) at most once per 36h
 *   b) at most one period_reminder of ANY kind per 24h
 */
export async function maybeCreatePeriodReminder(
  user: UserLike,
  latestCycle: CycleLike | null,
  opts: { sendPush?: boolean } = {}
): Promise<ReminderOutcome> {
  // Global kill-switch: user turned reminders off entirely.
  if (user.remindersEnabled === false) {
    return { triggered: false, reason: 'disabled' }
  }

  // Quiet hours: the reminder is not lost — the next evaluation outside the
  // window (per-user check on app open, or the 15-min sweep) will deliver it.
  if (isQuietHour(new Date(), user.quietStart, user.quietEnd)) {
    return { triggered: false, reason: 'quiet-hours' }
  }

  const decision = evaluatePeriodReminder(user, latestCycle)
  if (!decision) {
    return { triggered: false, reason: user.lastPeriodStart || latestCycle ? 'not-due' : 'no-cycle-data' }
  }

  const { title, message, daysUntilPeriod } = decision
  const userId = user.id

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
    return { triggered: false, reason: 'cooldown', daysUntilPeriod }
  }

  const notification = await db.notification.create({
    data: { userId, title, message, type: 'period_reminder' },
  })

  const push =
    opts.sendPush === false
      ? { sent: 0, pruned: 0, failed: 0, total: 0 }
      : await sendPushToUser(userId, {
          title,
          body: message,
          tag: 'chandracycle-period-reminder',
          url: '/dashboard',
          type: 'period_reminder',
        })

  return {
    triggered: true,
    daysUntilPeriod,
    title,
    messageId: notification.id,
    push,
  }
}
