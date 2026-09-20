import { NextRequest, NextResponse } from 'next/server'
import {
  verifyGoogleIdToken,
  upsertGoogleUser,
} from '@/lib/google-oauth'
import {
  issueSessionToken,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/auth'

// POST /api/auth/google — REAL Google sign-in only.
//
// The client sends the `credential` (ID token) produced by Google Identity
// Services after the user actually signs in with their Google account. The
// token is verified SERVER-SIDE against Google's public keys and must be
// issued for OUR configured client ID (audience check).
//
// There is deliberately NO fallback that trusts a bare email: every Google
// session originates from a Google-signed, server-verified token. Accounts
// created this way are marked provider='google'.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const idToken = body?.credential || body?.idToken || body?.id_token

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        {
          error:
            'A real Google ID token is required. Sign in through the official Google popup — entering an email is not sign-in.',
        },
        { status: 400 }
      )
    }

    // Cryptographically verifies the token with Google's public keys and our
    // audience. Throws (→ 401) if the token is fake, expired, or for another app.
    const profile = await verifyGoogleIdToken(idToken)
    const sessionUser = await upsertGoogleUser(profile)
    const token = issueSessionToken(sessionUser)

    const response = NextResponse.json({ user: sessionUser, token })
    response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS)
    return response
  } catch (error) {
    console.error('[google-auth] Sign-in rejected:', error)
    const detail = error instanceof Error ? error.message : String(error)
    const notConfigured = detail.includes('not configured')
    return NextResponse.json(
      {
        error: notConfigured
          ? 'Google Sign-In is not configured yet. Add your Google OAuth credentials in Settings → Google Sign-In.'
          : 'Google could not verify this sign-in. Please try the popup again.',
        detail: process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV ? undefined : detail,
      },
      { status: notConfigured ? 503 : 401 }
    )
  }
}
