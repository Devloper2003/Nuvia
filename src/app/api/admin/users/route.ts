import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/admin-guard'

// ─── GET /api/admin/users ────────────────────────────────────────────────────
// Basement user explorer. SUPER_ADMIN only. Two modes:
//   ?detail=<userId>  → full dossier (profile, aggregates, recents, devices)
//   default           → paginated, searchable directory
// Password hashes are NEVER selected. Everything else the operator sees.

const PAGE_SIZE = 20

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3_600_000)
}

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const detailId = searchParams.get('detail')

    // ── Dossier mode ────────────────────────────────────────────────────────
    if (detailId) {
      const user = await db.user.findUnique({
        where: { id: detailId },
        select: {
          id: true, email: true, name: true, avatar: true, phone: true,
          provider: true, dateOfBirth: true, height: true, weight: true,
          cycleLength: true, periodLength: true, lastPeriodStart: true,
          onboardingComplete: true, remindersEnabled: true,
          city: true, country: true,
          accountStatus: true, banReason: true, notes: true, flagged: true,
          emailVerified: true, lastLoginAt: true,
          subscriptionTier: true, subscriptionStatus: true, subscriptionPlan: true,
          subscriptionStart: true, subscriptionEnd: true,
          createdAt: true, updatedAt: true,
        },
      })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const [
        posts, comments, cycles, symptoms, moods, sleeps, waters,
        chats, notifications, reports, devices, appointments, pcos,
      ] = await Promise.all([
        db.communityPost.count({ where: { userId: user.id } }),
        db.comment.count({ where: { userId: user.id } }),
        db.cycle.count({ where: { userId: user.id } }),
        db.symptomEntry.count({ where: { userId: user.id } }),
        db.moodEntry.count({ where: { userId: user.id } }),
        db.sleepEntry.count({ where: { userId: user.id } }),
        db.waterEntry.count({ where: { userId: user.id } }),
        db.chatMessage.count({ where: { userId: user.id } }),
        db.notification.count({ where: { userId: user.id } }),
        db.contentReport.count({ where: { reporterId: user.id } }),
        db.authSession.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true, deviceInfo: true, ipAddress: true, location: true,
            createdAt: true, expiresAt: true, revoked: true,
          },
        }),
        db.appointment.count({ where: { userId: user.id } }),
        db.pCOSRecord.count({ where: { userId: user.id } }),
      ])

      const [recentPosts, recentComments, recentCycles, recentSymptoms] = await Promise.all([
        db.communityPost.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, title: true, category: true, likes: true, hidden: true, reportedCount: true, createdAt: true },
        }),
        db.comment.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, content: true, hidden: true, reportedCount: true, createdAt: true, post: { select: { title: true } } },
        }),
        db.cycle.findMany({
          where: { userId: user.id },
          orderBy: { startDate: 'desc' },
          take: 5,
          select: { id: true, startDate: true, endDate: true },
        }),
        db.symptomEntry.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, date: true, category: true, severity: true, notes: true },
        }),
      ])

      return NextResponse.json({
        user,
        aggregates: {
          posts, comments, cycles, symptoms, moods, sleeps, waters,
          chats, notifications, reportsMade: reports, appointments, pcosRecords: pcos,
          devices: devices.length,
        },
        devices,
        recentPosts,
        recentComments,
        recentCycles,
        recentSymptoms,
      })
    }

    // ── Directory mode ──────────────────────────────────────────────────────
    const q = (searchParams.get('q') ?? '').trim()
    const status = searchParams.get('status') ?? ''
    const tier = searchParams.get('tier') ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)

    const where: Record<string, unknown> = {}
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (status === 'active' || status === 'suspended' || status === 'banned' || status === 'pending') {
      where.accountStatus = status
    } else if (status === 'flagged') {
      where.flagged = true
    } else if (status === 'new') {
      where.createdAt = { gte: daysAgo(7) }
    }
    if (tier === 'premium') {
      where.subscriptionTier = { in: ['premium', 'plus'] }
    }

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true, name: true, email: true, avatar: true, provider: true,
          accountStatus: true, flagged: true, banReason: true,
          onboardingComplete: true, lastLoginAt: true, createdAt: true,
          subscriptionTier: true, subscriptionStatus: true, subscriptionEnd: true,
          city: true, country: true,
          _count: { select: { communityPosts: true, comments: true, cycles: true, symptoms: true, notifications: true } },
        },
      }),
    ])

    return NextResponse.json({
      users,
      total,
      page,
      pageSize: PAGE_SIZE,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    })
  } catch (error) {
    console.error('Basement users error:', error)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }
}
