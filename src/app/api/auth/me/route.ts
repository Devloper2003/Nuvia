import { NextRequest, NextResponse } from 'next/server'
import { parseCookies, SESSION_COOKIE, toSessionUser, verifyToken } from '@/lib/auth'
import { db } from '@/lib/db'

// Resolve a token → live user. Returns:
//   { user, token }        → live session (DB row exists)
//   { ghost: true }        → signature valid but the account no longer exists
//   { fallbackUser, token} → DB unreachable; trust the JWT-embedded copy
//   null                   → invalid/expired token
async function resolveToken(token: string) {
  const payload = verifyToken(token)
  if (!payload) return null
  const exp = payload.exp as number | undefined
  if (exp && Date.now() > exp) return null

  const sub = typeof payload.sub === 'string' ? payload.sub : null
  if (sub) {
    try {
      const fresh = await db.user.findUnique({ where: { id: sub } })
      if (fresh) return { user: toSessionUser(fresh), token }
      // Row gone (account deleted / DB reset) → ghost session, NOT a DB outage.
      return { ghost: true as const }
    } catch {
      // DB unavailable — fall back to the JWT-embedded user copy. This keeps
      // login alive during DB outages; it must only apply when the DB is DOWN.
      const u = payload.u as Record<string, unknown> | undefined
      if (u && typeof u.email === 'string') {
        return {
          token,
          fallbackUser: {
            id: sub,
            name: (u.name as string | null) ?? null,
            email: u.email,
            avatar: (u.avatar as string | null) ?? null,
            provider: (u.provider as string) ?? 'email',
            onboardingComplete: (u.onboardingComplete as boolean) ?? false,
            cycleLength: (u.cycleLength as number) ?? 28,
            periodLength: (u.periodLength as number) ?? 5,
            lastPeriodStart: (u.lastPeriodStart as string | null) ?? null,
          },
        }
      }
      return null
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const cookies = parseCookies(request.headers.get('cookie'))
    const cookieToken = cookies[SESSION_COOKIE]
    const headerToken = request.headers.get('authorization')?.replace('Bearer ', '') || null

    // Cookie first (httpOnly sessions from login/Google), then the explicit
    // Bearer token. A STALE cookie pointing at a deleted account must not
    // mask a live Bearer token the same client explicitly sent — so we try
    // both and the first live user wins.
    for (const token of [cookieToken, headerToken]) {
      if (!token) continue
      const result = await resolveToken(token)
      if (!result) continue
      if ('ghost' in result) continue // try the next candidate token
      return NextResponse.json({ user: 'fallbackUser' in result ? result.fallbackUser : result.user, token: result.token })
    }

    return NextResponse.json({ user: null }, { status: 200 })
  } catch (error) {
    console.error('Me error:', error)
    return NextResponse.json({ user: null }, { status: 200 })
  }
}
