import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { computeSubscriptionEnd } from '@/lib/auth'

// ─── POST /api/admin/actions ─────────────────────────────────────────────────
// Basement control actions. SUPER_ADMIN only. Every action is written to the
// AuditLog trail with the operator identity + target details.
//
// Body: { action, userId?, reason?, plan?, title?, message?, type? }
//   suspend_user    → accountStatus='suspended' (+ reason)
//   activate_user   → accountStatus='active' (clears ban reason)
//   ban_user        → accountStatus='banned' (+ reason)
//   flag_user       → flagged=true
//   unflag_user     → flagged=false
//   add_note        → appends an operator note to User.notes
//   grant_premium   → tier=premium, status=active, plan+end computed
//   revoke_premium  → tier=free, status=expired
//   force_logout    → revokes every AuthSession for the user (devices kicked)
//   delete_user     → permanent cascade delete (confirm required client-side)
//   broadcast       → in-app Notification to every non-banned user
//   revoke_own_session → kills the calling operator's current session (Lock)

export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const action: string = body.action
    const userId: string | undefined = body.userId
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null

    const audit = (a: string, targetType: string, targetId: string | null, targetLabel: string, details: string) =>
      db.auditLog.create({
        data: {
          adminId: admin.id,
          adminName: admin.name,
          action: `basement:${a}`,
          targetType,
          targetId,
          targetLabel,
          details,
          ipAddress: ip,
        },
      })

    switch (action) {
      // ── Account status ────────────────────────────────────────────────────
      case 'suspend_user':
      case 'ban_user': {
        const status = action === 'ban_user' ? 'banned' : 'suspended'
        const reason = typeof body.reason === 'string' ? body.reason.slice(0, 300) : 'No reason provided'
        const user = await db.user.update({
          where: { id: userId },
          data: { accountStatus: status, banReason: reason },
          select: { email: true, name: true },
        })
        // Kicking their device sessions too — a suspended account shouldn't
        // keep live sessions.
        await db.authSession.updateMany({ where: { userId: userId! }, data: { revoked: true, revokedAt: new Date() } })
        await audit(action, 'user', userId, user.email, `status=${status} · reason="${reason}"`)
        return NextResponse.json({ success: true, message: `${user.name ?? user.email} ${status}` })
      }

      case 'activate_user': {
        const user = await db.user.update({
          where: { id: userId },
          data: { accountStatus: 'active', banReason: null },
          select: { email: true, name: true },
        })
        await audit('activate_user', 'user', userId, user.email, 'account re-activated')
        return NextResponse.json({ success: true, message: `${user.name ?? user.email} re-activated` })
      }

      case 'flag_user':
      case 'unflag_user': {
        const flagged = action === 'flag_user'
        const user = await db.user.update({
          where: { id: userId },
          data: { flagged },
          select: { email: true, name: true },
        })
        await audit(action, 'user', userId, user.email, `flagged=${flagged}`)
        return NextResponse.json({ success: true, message: `${user.name ?? user.email} ${flagged ? 'flagged' : 'unflagged'}` })
      }

      case 'add_note': {
        const note = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''
        if (!note) return NextResponse.json({ error: 'note text is required' }, { status: 400 })
        const existing = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true, notes: true } })
        if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        const stamped = `[${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${admin.name}] ${note}`
        const merged = existing.notes ? `${existing.notes}\n${stamped}` : stamped
        await db.user.update({ where: { id: userId }, data: { notes: merged.slice(-4000) } })
        await audit('add_note', 'user', userId, existing.email, note)
        return NextResponse.json({ success: true, message: 'Note added' })
      }

      // ── Subscription ──────────────────────────────────────────────────────
      case 'grant_premium': {
        const plan = body.plan === 'yearly' ? 'yearly' : 'monthly'
        const end = computeSubscriptionEnd(plan)
        const user = await db.user.update({
          where: { id: userId },
          data: {
            subscriptionTier: 'premium',
            subscriptionStatus: 'active',
            subscriptionPlan: plan,
            subscriptionStart: new Date(),
            subscriptionEnd: end,
          },
          select: { email: true, name: true },
        })
        await audit('grant_premium', 'user', userId, user.email, `plan=${plan} · ends=${end.toISOString().slice(0, 10)}`)
        return NextResponse.json({ success: true, message: `Premium (${plan}) granted to ${user.name ?? user.email}` })
      }

      case 'revoke_premium': {
        const user = await db.user.update({
          where: { id: userId },
          data: { subscriptionTier: 'free', subscriptionStatus: 'expired', subscriptionEnd: new Date() },
          select: { email: true, name: true },
        })
        await audit('revoke_premium', 'user', userId, user.email, 'premium revoked')
        return NextResponse.json({ success: true, message: `Premium revoked for ${user.name ?? user.email}` })
      }

      // ── Sessions & deletion ───────────────────────────────────────────────
      case 'force_logout': {
        const result = await db.authSession.updateMany({
          where: { userId: userId!, revoked: false },
          data: { revoked: true, revokedAt: new Date() },
        })
        const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } })
        await audit('force_logout', 'user', userId, user?.email ?? userId, `${result.count} device session(s) revoked`)
        return NextResponse.json({ success: true, message: `${result.count} device session(s) revoked` })
      }

      case 'delete_user': {
        const user = await db.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true, createdAt: true },
        })
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
        // Audit BEFORE the cascade (the row is about to vanish; keep the paper trail).
        await audit(
          'delete_user', 'user', userId, user.email,
          `PERMANENT delete · joined=${user.createdAt.toISOString().slice(0, 10)}`
        )
        await db.user.delete({ where: { id: userId } })
        return NextResponse.json({ success: true, message: `${user.name ?? user.email} permanently deleted` })
      }

      // ── Broadcast ─────────────────────────────────────────────────────────
      case 'broadcast': {
        const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : ''
        const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : ''
        const type = typeof body.type === 'string' ? body.type.slice(0, 40) : 'admin'
        if (!title || !message) {
          return NextResponse.json({ error: 'title and message are required' }, { status: 400 })
        }
        const recipients = await db.user.findMany({
          where: { accountStatus: { not: 'banned' } },
          select: { id: true },
        })
        await db.notification.createMany({
          data: recipients.map((u) => ({ userId: u.id, title, message, type })),
        })
        await audit('broadcast', 'notification', null, title, `sent to ${recipients.length} users · type=${type}`)
        return NextResponse.json({ success: true, message: `Broadcast delivered to ${recipients.length} users` })
      }

      // ── Self (Lock the basement) ──────────────────────────────────────────
      case 'revoke_own_session': {
        const header = request.headers.get('authorization') ?? ''
        const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
        await db.adminSession.updateMany({ where: { token }, data: { revoked: true } })
        await audit('lock_basement', 'admin_session', admin.id, admin.email, 'operator locked the basement')
        return NextResponse.json({ success: true, message: 'Basement locked' })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Basement action error:', error)
    return NextResponse.json({ error: 'Action failed' }, { status: 500 })
  }
}
