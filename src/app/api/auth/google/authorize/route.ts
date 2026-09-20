import { NextRequest, NextResponse } from 'next/server'
import {
  getGoogleCredentials,
  isGoogleCodeFlowReady,
  deriveOrigin,
  buildGoogleAuthorizeUrl,
  newGoogleState,
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_COOKIE_OPTIONS,
} from '@/lib/google-oauth'

// GET /api/auth/google/authorize
// Starts the REAL Google OAuth 2.0 authorization-code flow: 302 the browser to
// accounts.google.com where the user signs in with their actual Google account.
// Google then redirects back to /api/auth/google/callback with a one-time code.
//
// Requires client ID **and** secret (configured via env or Settings → Google
// Sign-In). If not ready, bounce back to the home screen with a hint.

export async function GET(request: NextRequest) {
  const origin = deriveOrigin(request)

  if (!(await isGoogleCodeFlowReady())) {
    return NextResponse.redirect(`${origin}/?auth_error=google_not_configured`)
  }

  const { clientId } = await getGoogleCredentials()
  const state = newGoogleState()

  const response = NextResponse.redirect(buildGoogleAuthorizeUrl(origin, state, clientId))
  // CSRF protection: the callback must see the same state value.
  response.cookies.set(GOOGLE_STATE_COOKIE, state, GOOGLE_STATE_COOKIE_OPTIONS)
  return response
}
