import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/admin-guard'

// ─── GET /api/admin/overview ─────────────────────────────────────────────────
// Basement control centre: platform-wide intelligence pulse. SUPER_ADMIN only.
// Returns user/content/engagement KPIs, 14-day growth series, provider and
// tier breakdowns, recent signups & posts, and a DB health probe.

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3_600_000)
}

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const t0 = Date.now()
    await db.$queryRaw`SELECT 1`
    const dbLatencyMs = Date.now() - t0

    const [
      totalUsers, newUsers7d, newUsers30d, active24h, active7d,
      onboardedUsers, googleUsers, suspendedUsers, bannedUsers, flaggedUsers,
      premiumUsers, trialingUsers,
      totalPosts, totalComments, hiddenPosts, hiddenComments,
      reportedPosts, reportedComments, totalLikes, totalReports,
      totalCycles, totalSymptoms, totalMoods, totalChats,
      totalNotifications, pushSubs, totalAppointments,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: daysAgo(7) } } }),
      db.user.count({ where: { createdAt: { gte: daysAgo(30) } } }),
      db.user.count({ where: { lastLoginAt: { gte: daysAgo(1) } } }),
      db.user.count({ where: { lastLoginAt: { gte: daysAgo(7) } } }),
      db.user.count({ where: { onboardingComplete: true } }),
      db.user.count({ where: { provider: 'google' } }),
      db.user.count({ where: { accountStatus: 'suspended' } }),
      db.user.count({ where: { accountStatus: 'banned' } }),
      db.user.count({ where: { flagged: true } }),
      db.user.count({ where: { subscriptionTier: { in: ['premium', 'plus'] }, subscriptionStatus: 'active' } }),
      db.user.count({ where: { subscriptionStatus: 'trialing' } }),
      db.communityPost.count(),
      db.comment.count(),
      db.communityPost.count({ where: { hidden: true } }),
      db.comment.count({ where: { hidden: true } }),
      db.communityPost.count({ where: { reportedCount: { gt: 0 } } }),
      db.comment.count({ where: { reportedCount: { gt: 0 } } }),
      db.communityPost.aggregate({ _sum: { likes: true } }),
      db.contentReport.count(),
      db.cycle.count(),
      db.symptomEntry.count(),
      db.moodEntry.count(),
      db.chatMessage.count(),
      db.notification.count(),
      db.pushSubscription.count(),
      db.appointment.count(),
    ])

    // ── 14-day growth series (signups + community activity per day) ──
    const since = daysAgo(13)
    since.setHours(0, 0, 0, 0)
    const [recentUsers, recentPosts, recentComments] = await Promise.all([
      db.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      db.communityPost.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      db.comment.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ])
    const series: { date: string; label: string; signups: number; posts: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3_600_000)
      const key = d.toISOString().slice(0, 10)
      series.push({
        date: key,
        label: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
        signups: 0,
        posts: 0,
      })
    }
    const bucketOf = (iso: Date) => iso.toISOString().slice(0, 10)
    for (const u of recentUsers) {
      const b = series.find((s) => s.date === bucketOf(u.createdAt))
      if (b) b.signups++
    }
    for (const p of [...recentPosts, ...recentComments]) {
      const b = series.find((s) => s.date === bucketOf(p.createdAt))
      if (b) b.posts++
    }

    // ── Recent signups & latest community posts ──
    const latestUsers = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true, name: true, email: true, provider: true, avatar: true,
        accountStatus: true, subscriptionTier: true, lastLoginAt: true, createdAt: true,
      },
    })
    const latestPosts = await db.communityPost.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true, title: true, category: true, likes: true, hidden: true,
        reportedCount: true, createdAt: true,
        user: { select: { name: true, email: true } },
      },
    })

    return NextResponse.json({
      kpis: {
        users: {
          total: totalUsers, new7d: newUsers7d, new30d: newUsers30d,
          active24h, active7d, onboarded: onboardedUsers,
          google: googleUsers, email: totalUsers - googleUsers,
          suspended: suspendedUsers, banned: bannedUsers, flagged: flaggedUsers,
          premium: premiumUsers, trialing: trialingUsers,
        },
        content: {
          posts: totalPosts, comments: totalComments,
          hiddenPosts, hiddenComments, reportedPosts, reportedComments,
          likes: totalLikes._sum.likes ?? 0, openReports: totalReports,
        },
        engagement: {
          cycles: totalCycles, symptoms: totalSymptoms, moods: totalMoods,
          chats: totalChats, notifications: totalNotifications,
          pushDevices: pushSubs, appointments: totalAppointments,
        },
      },
      series,
      latestUsers,
      latestPosts,
      health: {
        dbLatencyMs,
        serverTime: new Date().toISOString(),
        sessionExpiresAt: (await db.adminSession.findFirst({
          // the caller's own session — cheap lookup for the countdown badge
          where: { adminId: admin.id, revoked: false, expiresAt: { gt: new Date() } },
          orderBy: { expiresAt: 'desc' },
          select: { expiresAt: true },
        }))?.expiresAt ?? null,
      },
      operator: { name: admin.name, email: admin.email, role: admin.role },
    })
  } catch (error) {
    console.error('Basement overview error:', error)
    return NextResponse.json({ error: 'Failed to load overview' }, { status: 500 })
  }
}
