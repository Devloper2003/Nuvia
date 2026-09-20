import { NextRequest, NextResponse } from 'next/server'
import {
  getGoogleCredentials,
  deriveOrigin,
  exchangeGoogleCode,
  upsertGoogleUser,
  GOOGLE_STATE_COOKIE,
} from '@/lib/google-oauth'
import { issueSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS, parseCookies } from '@/lib/auth'

// GET /api/auth/google/callback
// The end of the REAL Google OAuth 2.0 authorization-code flow.
//  1. Verify the CSRF `state` (cookie ↔ query) — rejects forged redirects.
//  2. Exchange the one-time authorization code for tokens — SERVER-to-SERVER
//     with Google (the client secret never leaves the backend).
//  3. Verify the returned id_token (signed by Google, audience = our client).
//  4. Upsert the Nuvia user and issue a slim session cookie, then return to
//     the app at /?auth=google.

export async function GET(request: NextRequest) {
  const origin = deriveOrigin(request)
  const { searchParams } = new URL(request.url)

  const fail = (code: string) => NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(code)}`)

  try {
    const error = searchParams.get('error')
    if (error) return fail(error === 'access_denied' ? 'google_denied' : `google_${error}`)

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    if (!code || !state) return fail('google_missing_code')

    const cookies = parseCookies(request.headers.get('cookie'))
    const cookieState = cookies[GOOGLE_STATE_COOKIE]
    if (!cookieState || cookieState !== state) return fail('google_state_mismatch')

    const { clientId, clientSecret } = await getGoogleCredentials()
    if (!clientId || !clientSecret) return fail('google_not_configured')

    const profile = await exchangeGoogleCode(code, origin, clientId, clientSecret)
    const sessionUser = await upsertGoogleUser(profile)
    const token = issueSessionToken(sessionUser)

    const response = NextResponse.redirect(`${origin}/?auth=google`)
    response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS)
    // Clear the one-time CSRF state cookie.
    response.cookies.set(GOOGLE_STATE_COOKIE, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 })
    return response
  } catch (error) {
    console.error('[google-auth] Callback failed:', error)
    const detail = error instanceof Error ? error.message : String(error)
    // Surface a short, stable code to the UI; log the full detail server-side.
    const code = detail.includes('redirect_uri_mismatch')
      ? 'google_redirect_mismatch'
      : detail.includes('invalid_client')
        ? 'google_invalid_client'
        : 'google_callback_failed'
    return fail(code)
  }
}
