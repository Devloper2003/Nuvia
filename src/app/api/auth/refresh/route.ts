import { NextRequest, NextResponse } from 'next/server'
import {
  verifyToken,
  issueSessionToken,
  userFromPayloadSafe,
  toSessionUser,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/auth/refresh — slim-token self-heal.
//
// Legacy sessions may carry oversized payloads (e.g. a 44KB avatar embedded in
// the JWT). Those tokens break every Authorization header (431), so this route
// deliberately accepts the OLD token in the request BODY (body size is not
// limited by HTTP header caps) and returns a freshly-signed slim token.
//
// Never require the Authorization header on this route — that is the exact
// header that fails with 431 for the tokens we are trying to heal.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const oldToken = typeof body?.token === 'string' ? body.token : ''
    if (!oldToken) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 })
    }

    const payload = verifyToken(oldToken)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const exp = typeof payload.exp === 'number' ? payload.exp : 0
    if (exp && Date.now() > exp) {
      return NextResponse.json({ error: 'Session expired — please sign in again' }, { status: 401 })
    }

    // Prefer fresh DB data; fall back to the sanitized embedded user.
    let sessionUser = null
    const sub = typeof payload.sub === 'string' ? payload.sub : null
    if (sub) {
      try {
        const user = await db.user.findUnique({ where: { id: sub } })
        if (user) sessionUser = toSessionUser(user)
      } catch {
        // DB unavailable — fall through to embedded claims
      }
    }
    if (!sessionUser) sessionUser = userFromPayloadSafe(payload)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 })
    }

    const token = issueSessionToken(sessionUser)
    const response = NextResponse.json({ user: sessionUser, token })
    response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS)
    return response
  } catch (error) {
    console.error('[auth] Refresh failed:', error)
    return NextResponse.json({ error: 'Could not refresh session' }, { status: 500 })
  }
}
