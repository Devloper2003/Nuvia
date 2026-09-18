import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { maybeCreatePeriodReminder } from '@/lib/reminders'

// ─── POST|GET /api/cron/reminders — server-side reminder sweep ───────────────
// Called periodically by mini-services/reminder-scheduler so period reminders
// arrive even when the app is closed (in-app row + web-push fan-out).
//
// Sweeps every user that has cycle data, reusing the exact same engine and
// cooldowns as the per-user check endpoint (one source of truth:
// src/lib/reminders.ts).
//
// Auth: if CRON_SECRET is set in .env, the caller must present it via the
// `x-cron-secret` header or `?secret=` query param. Unset → open (sandbox).
//
// GET returns the last sweep summary held in memory (for observability).

interface SweepUserOutcome {
  userId: string
  outcome: 'triggered' | 'not-due' | 'no-cycle-data' | 'cooldown' | 'error'
  daysUntilPeriod?: number
  title?: string
  pushSent?: number
}

// In-memory last-run summary (per server process; dev-only observability).
let lastSweep: { at: string; swept: number; triggered: number; cooldown: number; notDue: number; noCycleData: number; errors: number; pushesSent: number } | null = null

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const header = request.headers.get('x-cron-secret')
  const query = request.nextUrl.searchParams.get('secret')
  return header === secret || query === secret
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const users = await db.user.findMany({
      where: { onboardingComplete: true },
      select: {
        id: true,
        cycleLength: true,
        lastPeriodStart: true,
        cycles: { orderBy: { startDate: 'desc' }, take: 1 },
      },
    })

    const results: SweepUserOutcome[] = []
    const tally = { triggered: 0, cooldown: 0, notDue: 0, noCycleData: 0, errors: 0, pushesSent: 0 }

    // Small batches keep DB + push fan-out pressure low even as users grow.
    const BATCH = 20
    for (let i = 0; i < users.length; i += BATCH) {
      const batch = users.slice(i, i + BATCH)
      await Promise.all(
        batch.map(async (user) => {
          try {
            const outcome = await maybeCreatePeriodReminder(user, user.cycles[0] ?? null)
            if (outcome.triggered) {
              tally.triggered++
              tally.pushesSent += outcome.push?.sent ?? 0
              results.push({
                userId: user.id,
                outcome: 'triggered',
                daysUntilPeriod: outcome.daysUntilPeriod,
                title: outcome.title,
                pushSent: outcome.push?.sent ?? 0,
              })
            } else if (outcome.reason === 'cooldown') {
              tally.cooldown++
              results.push({ userId: user.id, outcome: 'cooldown' })
            } else if (outcome.reason === 'no-cycle-data') {
              tally.noCycleData++
              results.push({ userId: user.id, outcome: 'no-cycle-data' })
            } else {
              tally.notDue++
              results.push({ userId: user.id, outcome: 'not-due' })
            }
          } catch (err) {
            tally.errors++
            console.error(`Sweep failed for user ${user.id}:`, err)
            results.push({ userId: user.id, outcome: 'error' })
          }
        })
      )
    }

    lastSweep = {
      at: new Date().toISOString(),
      swept: users.length,
      triggered: tally.triggered,
      cooldown: tally.cooldown,
      notDue: tally.notDue,
      noCycleData: tally.noCycleData,
      errors: tally.errors,
      pushesSent: tally.pushesSent,
    }

    return NextResponse.json({ ok: true, ...lastSweep, results })
  } catch (error) {
    console.error('Reminder sweep failed:', error)
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ lastSweep: lastSweep ?? null })
}
