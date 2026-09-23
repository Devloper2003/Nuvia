import { NextRequest, NextResponse } from 'next/server'

// ─── Legacy session-cookie migration (ChandraCycle → Nuvia rebrand) ─────────
// The session cookie used to be named `chandracycle_session`; it is now
// `nuvia_session`. Users who logged in before the rebrand still carry the old
// httpOnly cookie, which they cannot read or rewrite from JS. This middleware
// transparently migrates it: the CURRENT request already authenticates (the
// legacy value is merged into the forwarded cookie header) and the new cookie
// is set on the response, so every subsequent request is fully migrated.
//
// The legacy name must stay in sync with the pre-rebrand SESSION_COOKIE value.
const LEGACY_SESSION_COOKIE = 'chandracycle_session'
const NEW_SESSION_COOKIE = 'nuvia_session'

export function middleware(request: NextRequest) {
  const legacy = request.cookies.get(LEGACY_SESSION_COOKIE)?.value
  const modern = request.cookies.get(NEW_SESSION_COOKIE)?.value

  if (!legacy || modern) return NextResponse.next()

  // 1) Make the same request authenticate: append the legacy value under the
  //    new name on the forwarded cookie header.
  const headers = new Headers(request.headers)
  const existing = headers.get('cookie') ?? ''
  headers.set('cookie', `${existing}; ${NEW_SESSION_COOKIE}=${encodeURIComponent(legacy)}`)

  // 2) Persist the migrated cookie on the response (30 days, mirrors
  //    SESSION_COOKIE_OPTIONS in src/lib/auth.ts).
  const response = NextResponse.next({ request: { headers } })
  response.cookies.set(NEW_SESSION_COOKIE, legacy, {
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}

export const config = {
  // Run on everything except static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|manifest)$).*)'],
}
