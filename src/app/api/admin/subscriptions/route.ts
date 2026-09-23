import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { computeSubscriptionEnd } from '@/lib/auth'
import { requireSuperAdmin } from '@/lib/admin-guard'

// ─── GET /api/admin/subscriptions ────────────────────────────────────────────
// Revenue desk: every user's subscription state + Subscription ledger + totals.
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, name: true, accountStatus: true,
      subscriptionTier: true, subscriptionStatus: true, subscriptionPlan: true,
      subscriptionStart: true, subscriptionEnd: true, trialEndDate: true,
      _count: { select: { subscriptions: true } },
    },
  })

  const ledger = await db.subscription.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, userId: true, plan: true, tier: true, amount: true, gst: true, total: true,
      currency: true, status: true, startDate: true, endDate: true, paymentMethod: true,
      transactionId: true, invoiceId: true, createdAt: true,
      user: { select: { email: true, name: true } },
    },
  })

  const now = new Date()
  const activeUsers = users.filter((u) =>
    u.subscriptionStatus === 'active' && u.subscriptionEnd && new Date(u.subscriptionEnd) > now
  )
  const mrr = activeUsers.reduce((sum, u) => {
    if (u.subscriptionPlan === 'yearly') return sum + 999 / 12
    return sum + (u.subscriptionTier === 'plus' ? 299 : 149)
  }, 0)
  const revenueTotal = await db.subscription.aggregate({
    where: { status: { in: ['active', 'expired', 'cancelled'] } },
    _sum: { total: true },
  })
  const trialUsers = users.filter((u) => u.subscriptionStatus === 'trialing' || (u.trialEndDate && new Date(u.trialEndDate) > now && !u.subscriptionTier)).length

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      active: !!(u.subscriptionStatus === 'active' && u.subscriptionEnd && new Date(u.subscriptionEnd) > now),
    })),
    ledger,
    summary: {
      totalUsers: users.length,
      activeCount: activeUsers.length,
      premiumCount: activeUsers.filter((u) => u.subscriptionTier === 'premium').length,
      plusCount: activeUsers.filter((u) => u.subscriptionTier === 'plus').length,
      trialCount: trialUsers,
      mrr: Math.round(mrr),
      revenueTotal: Math.round(revenueTotal._sum.total ?? 0),
    },
  })
}

// ─── PATCH /api/admin/subscriptions ──────────────────────────────────────────
// Body: { userId, action: extend | cancel | reactivate | set_plan | grant_trial, months?, tier?, plan? }
export async function PATCH(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const b = await request.json()
    const { userId, action } = b
    if (!userId || !action) return NextResponse.json({ error: 'userId and action are required' }, { status: 400 })

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    let details = ''
    let ledgerRecord: { plan: string; tier: string; amount: number; total: number } | null = null

    switch (action) {
      case 'set_plan': {
        const tier = ['premium', 'plus', 'free'].includes(b.tier) ? b.tier : 'premium'
        const plan = ['monthly', 'yearly'].includes(b.plan) ? b.plan : 'monthly'
        const end = tier === 'free' ? null : computeSubscriptionEnd(plan)
        await db.user.update({
          where: { id: userId },
          data: {
            subscriptionTier: tier === 'free' ? 'free' : tier,
            subscriptionStatus: tier === 'free' ? 'expired' : 'active',
            subscriptionPlan: tier === 'free' ? null : plan,
            subscriptionStart: tier === 'free' ? null : new Date(),
            subscriptionEnd: end,
          },
        })
        if (tier !== 'free') {
          const amount = plan === 'yearly' ? 999 : tier === 'plus' ? 299 : 149
          ledgerRecord = { plan, tier, amount, total: amount }
        }
        details = `${user.email} → ${tier}/${plan}${end ? ` until ${end.toISOString().slice(0, 10)}` : ''}`
        break
      }
      case 'extend': {
        const months = Math.min(24, Math.max(1, parseInt(b.months, 10) || 1))
        const base = user.subscriptionEnd && new Date(user.subscriptionEnd) > new Date() ? new Date(user.subscriptionEnd) : new Date()
        const end = new Date(base)
        end.setMonth(end.getMonth() + months)
        await db.user.update({ where: { id: userId }, data: { subscriptionEnd: end, subscriptionStatus: user.subscriptionStatus === 'expired' ? 'active' : user.subscriptionStatus } })
        details = `${user.email} extended by ${months}m → ${end.toISOString().slice(0, 10)}`
        break
      }
      case 'cancel': {
        await db.user.update({ where: { id: userId }, data: { subscriptionStatus: 'cancelled' } })
        await db.subscription.updateMany({ where: { userId, status: 'active' }, data: { status: 'cancelled' } })
        details = `${user.email} subscription cancelled`
        break
      }
      case 'reactivate': {
        await db.user.update({ where: { id: userId }, data: { subscriptionStatus: 'active' } })
        details = `${user.email} subscription re-activated`
        break
      }
      case 'grant_trial': {
        const end = new Date()
        end.setDate(end.getDate() + 7)
        await db.user.update({
          where: { id: userId },
          data: { subscriptionStatus: 'trialing', trialStartDate: new Date(), trialEndDate: end, subscriptionTier: user.subscriptionTier ?? 'premium' },
        })
        details = `${user.email} 7-day trial → ${end.toISOString().slice(0, 10)}`
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    if (ledgerRecord) {
      const gst = Math.round(ledgerRecord.amount * 18 / 118)
      await db.subscription.create({
        data: {
          userId, plan: ledgerRecord.plan, tier: ledgerRecord.tier,
          amount: ledgerRecord.amount - gst, gst, total: ledgerRecord.total,
          status: 'active', paymentMethod: 'admin-grant', endDate: computeSubscriptionEnd(ledgerRecord.plan),
          transactionId: `admin-${Date.now()}`,
        },
      })
    }

    await db.auditLog.create({
      data: {
        adminId: admin.id, adminName: admin.name, action: `revenue:${action}`,
        targetType: 'subscription', targetId: userId, targetLabel: user.email,
        details, ipAddress: ip,
      },
    }).catch(() => {})

    return NextResponse.json({ success: true, message: details })
  } catch (error) {
    console.error('Subscription patch error:', error)
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}
