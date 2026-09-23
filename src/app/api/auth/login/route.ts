import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { verifyPassword, issueSessionToken, toSessionUser, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/auth'
import { loginThrottleStatus, recordLoginFailure, clearLoginFailures, sweepThrottleMap } from '@/lib/admin-guard'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // ─── Operator fast-path (basement gate via the main login page) ────────────
    // AdminUser accounts live in a separate table from regular users, so the
    // "Welcome back" screen previously rejected operator credentials. When the
    // credentials match an ACTIVE operator, issue a DB-backed AdminSession and
    // return an `adminAuth` marker — the client then opens the hidden control
    // centre instead of the app shell. Same generic error message and the same
    // shared IP throttle as /api/admin/login → nothing about this endpoint
    // reveals that an operator account exists.
    sweepThrottleMap()
    const throttle = loginThrottleStatus(request)
    if (throttle.blocked) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${Math.ceil(throttle.retryAfterSec / 60)} min.` },
        { status: 429, headers: { 'retry-after': String(throttle.retryAfterSec) } }
      )
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    let admin: Awaited<ReturnType<typeof db.adminUser.findUnique>> = null
    try {
      admin = await db.adminUser.findUnique({ where: { email: normalizedEmail } })
    } catch {
      /* DB hiccup — fall through to the regular user path which handles 503 */
    }

    if (!admin) {
      // First-run bootstrap parity with /api/admin/login: provision the default
      // operator on a fresh deployment so the main login also works out of the box.
      try {
        const adminCount = await db.adminUser.count()
        if (adminCount === 0) {
          const { hashPassword } = await import('@/lib/auth')
          admin = await db.adminUser.create({
            data: {
              email: 'admin@nuvia.app',
              name: 'Nuvia Admin',
              passwordHash: await hashPassword('nuvia-admin'),
              role: 'super_admin',
            },
          })
        }
      } catch {
        /* bootstrap is best-effort only */
      }
    }

    if (admin && admin.active) {
      const adminOk = await verifyPassword(String(password), admin.passwordHash)
      if (adminOk) {
        clearLoginFailures(request)

        const token = randomBytes(32).toString('hex')
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null

        await db.adminSession.create({
          data: { token, adminId: admin.id, expiresAt, ipAddress: ip },
        })
        // Housekeeping: drop this operator's expired sessions.
        await db.adminSession.deleteMany({
          where: { adminId: admin.id, expiresAt: { lt: new Date() } },
        })
        await db.adminUser.update({
          where: { id: admin.id },
          data: { lastLoginAt: new Date() },
        })
        // Traceability: every basement entry is logged.
        try {
          await db.auditLog.create({
            data: {
              adminId: admin.id,
              adminName: admin.name,
              action: 'basement:entry',
              targetType: 'session',
              targetId: admin.id,
              targetLabel: admin.email,
              details: 'operator signed in via the main login page',
              ipAddress: ip,
            },
          })
        } catch {
          /* audit write is best-effort — never block a valid sign-in */
        }

        return NextResponse.json({
          adminAuth: true,
          token,
          expiresAt: expiresAt.toISOString(),
          admin: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
          },
        })
      }
      // Email belongs to an operator but the password is wrong → same generic
      // error as any other failed login (no account-existence leak).
      recordLoginFailure(request)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // ─── Regular user login (unchanged) ─────────────────────────────────────────
    let user
    try {
      user = await db.user.findUnique({ where: { email: normalizedEmail } })
    } catch (dbError) {
      console.error('Login DB error:', dbError)
      return NextResponse.json(
        {
          error:
            'Sign-in is temporarily unavailable. Please use "Continue with Google" instead — it works without a database.',
        },
        { status: 503 }
      )
    }
    if (!user || !user.password) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const valid = await verifyPassword(String(password), user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const sessionUser = toSessionUser(user)
    const token = issueSessionToken(sessionUser)
    const response = NextResponse.json({ user: sessionUser, token })
    response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS)
    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 })
  }
}
