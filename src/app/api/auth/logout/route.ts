import { NextResponse } from 'next/server'
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/auth'

// Legacy cookie name from before the ChandraCycle → Nuvia rebrand. Cleared on
// logout so the cookie-migration middleware (src/middleware.ts) cannot
// resurrect a signed-out session from a stale pre-rebrand cookie.
const LEGACY_SESSION_COOKIE = 'chandracycle_session'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 })
  response.cookies.set(LEGACY_SESSION_COOKIE, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 })
  return response
}
