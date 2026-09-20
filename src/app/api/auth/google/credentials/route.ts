import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromToken, parseCookies, SESSION_COOKIE } from '@/lib/auth'
import {
  getGoogleCredentials,
  invalidateGoogleConfigCache,
  deriveOrigin,
} from '@/lib/google-oauth'

// ─── Google OAuth credentials self-service (Settings → Google Sign-In) ───────
// Lets the app owner paste their REAL Google OAuth client credentials from the
// UI instead of editing .env. Stored in the SiteSetting table. Env vars always
// take precedence when present.
//
//   GET    → setup info: whether configured (env or DB), the exact authorized
//            origin + redirect URI to whitelist in Google Cloud Console, and a
//            MASKED preview of the stored client id (never the secret).
//   POST   → { clientId, clientSecret } — validates the shape, stores both.
//   DELETE → clears the DB-stored pair (env vars remain untouched).
//
// All mutating routes require a valid session.

function maskClient(idOrSecret: string): string {
  if (!idOrSecret) return ''
  if (idOrSecret.length <= 8) return '••••'
  return `${idOrSecret.slice(0, 6)}••••${idOrSecret.slice(-4)}`
}

async function requireSession(request: NextRequest) {
  const cookies = parseCookies(request.headers.get('cookie'))
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  const token = bearer || cookies[SESSION_COOKIE] || ''
  if (!token) return null
  return getUserFromToken(token)
}

export async function GET(request: NextRequest) {
  try {
    const [{ clientId, clientSecret }, origin] = await Promise.all([
      getGoogleCredentials(),
      Promise.resolve(deriveOrigin(request)),
    ])
    const envId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
    const envSecret = !!process.env.GOOGLE_CLIENT_SECRET
    let dbId = ''
    let dbSecret = false
    if (!envId || !envSecret) {
      try {
        const rows = await db.siteSetting.findMany({
          where: { key: { in: ['google_client_id', 'google_client_secret'] } },
        })
        for (const row of rows) {
          if (row.key === 'google_client_id' && !envId) dbId = row.value
          if (row.key === 'google_client_secret' && !envSecret) dbSecret = !!row.value
        }
      } catch {
        // DB unavailable
      }
    }
    return NextResponse.json({
      origin,
      redirectUri: `${origin}/api/auth/google/callback`,
      google: {
        configured: !!clientId,
        codeFlowReady: !!(clientId && clientSecret),
        source: envId ? (envSecret ? 'env' : 'env_id') : dbId ? 'app' : 'none',
        maskedClientId: maskClient(envId || dbId),
        dbStored: { clientId: !!dbId, clientSecret: dbSecret },
      },
    })
  } catch (error) {
    console.error('[google-auth] Setup info failed:', error)
    return NextResponse.json({ error: 'Could not load Google Sign-In setup' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await requireSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Sign in to configure Google Sign-In' }, { status: 401 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const clientId = typeof body?.clientId === 'string' ? body.clientId.trim() : ''
    const clientSecret = typeof body?.clientSecret === 'string' ? body.clientSecret.trim() : ''

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Both the Client ID and Client Secret are required' },
        { status: 400 }
      )
    }
    // Real Google OAuth client IDs look like: 1234567890-abc123.apps.googleusercontent.com
    if (!/^[0-9A-Za-z._-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
      return NextResponse.json(
        {
          error:
            'That does not look like a Google OAuth Client ID — it should end with ".apps.googleusercontent.com"',
        },
        { status: 400 }
      )
    }
    // Google OAuth client secrets start with "GOCSPX-".
    if (!/^GOCSPX-/.test(clientSecret)) {
      return NextResponse.json(
        {
          error:
            'That does not look like a Google Client Secret — it should start with "GOCSPX-" (from the OAuth client page).',
        },
        { status: 400 }
      )
    }

    await db.siteSetting.upsert({
      where: { key: 'google_client_id' },
      update: { value: clientId },
      create: { key: 'google_client_id', value: clientId },
    })
    await db.siteSetting.upsert({
      where: { key: 'google_client_secret' },
      update: { value: clientSecret },
      create: { key: 'google_client_secret', value: clientSecret },
    })
    invalidateGoogleConfigCache()

    return NextResponse.json({ ok: true, configured: true, codeFlowReady: true })
  } catch (error) {
    console.error('[google-auth] Saving credentials failed:', error)
    return NextResponse.json({ error: 'Could not save credentials' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Sign in to manage Google Sign-In' }, { status: 401 })
  }
  try {
    await db.siteSetting.deleteMany({
      where: { key: { in: ['google_client_id', 'google_client_secret'] } },
    })
    invalidateGoogleConfigCache()
    return NextResponse.json({ ok: true, cleared: true })
  } catch (error) {
    console.error('[google-auth] Clearing credentials failed:', error)
    return NextResponse.json({ error: 'Could not clear credentials' }, { status: 500 })
  }
}
