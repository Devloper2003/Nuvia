import { OAuth2Client } from 'google-auth-library'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { toSessionUser, SessionUser } from '@/lib/auth'

// ─── Real Google OAuth helpers ────────────────────────────────────────────────
// Credentials resolve in this order:
//   1. Environment variables (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET,
//      also NEXT_PUBLIC_GOOGLE_CLIENT_ID for the ID-only case)
//   2. Database SiteSetting rows (`google_client_id` / `google_client_secret`)
//      so the app owner can configure real Google sign-in from inside the app
//      (Settings → Google Sign-In) without touching a .env file.
//
// NOTHING here accepts an unverified email — the only way to sign in via
// Google is a real Google-issued, server-verified ID token.

const DB_CONFIG_KEYS = {
  clientId: 'google_client_id',
  clientSecret: 'google_client_secret',
} as const

type CachedConfig = { clientId: string; clientSecret: string; fetchedAt: number }
let configCache: CachedConfig | null = null
const CONFIG_CACHE_MS = 30_000

function readEnv(name: string): string {
  const v = process.env[name]
  return typeof v === 'string' ? v.trim() : ''
}

export function invalidateGoogleConfigCache() {
  configCache = null
}

async function readSiteSetting(key: string): Promise<string> {
  try {
    const row = await db.siteSetting.findUnique({ where: { key } })
    return row?.value?.trim() || ''
  } catch {
    return '' // DB unavailable — env-only mode
  }
}

export async function getGoogleCredentials(): Promise<{ clientId: string; clientSecret: string }> {
  const envId = readEnv('GOOGLE_CLIENT_ID') || readEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID')
  const envSecret = readEnv('GOOGLE_CLIENT_SECRET')
  if (envId && envSecret) {
    return { clientId: envId, clientSecret: envSecret }
  }
  if (configCache && Date.now() - configCache.fetchedAt < CONFIG_CACHE_MS) {
    return { clientId: configCache.clientId, clientSecret: configCache.clientSecret }
  }
  const [dbId, dbSecret] = await Promise.all([
    envId ? Promise.resolve(envId) : readSiteSetting(DB_CONFIG_KEYS.clientId),
    envSecret ? Promise.resolve(envSecret) : readSiteSetting(DB_CONFIG_KEYS.clientSecret),
  ])
  configCache = { clientId: dbId, clientSecret: dbSecret, fetchedAt: Date.now() }
  return { clientId: dbId, clientSecret: dbSecret }
}

export async function getGoogleClientId(): Promise<string> {
  const envId = readEnv('GOOGLE_CLIENT_ID') || readEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID')
  if (envId) return envId
  // Single source of truth — never touch the cache directly here, so the
  // cached clientSecret cannot be clobbered with a stale empty value.
  const { clientId } = await getGoogleCredentials()
  return clientId
}

export async function isGoogleConfigured(): Promise<boolean> {
  return !!(await getGoogleClientId())
}

/** Full server-side code flow needs BOTH the client id and the secret. */
export async function isGoogleCodeFlowReady(): Promise<boolean> {
  const { clientId, clientSecret } = await getGoogleCredentials()
  return !!(clientId && clientSecret)
}

// ─── ID token verification (GIS popup / One Tap flow) ────────────────────────

let verifyClient: OAuth2Client | null = null
function getVerifyClient(): OAuth2Client {
  if (!verifyClient) verifyClient = new OAuth2Client()
  return verifyClient
}

export interface GoogleProfile {
  sub: string
  email: string
  name: string
  picture: string | null
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const clientId = await getGoogleClientId()
  if (!clientId) {
    throw new Error('Google Sign-In is not configured on this server yet.')
  }
  const ticket = await getVerifyClient().verifyIdToken({ idToken, audience: clientId })
  const payload = ticket.getPayload()
  if (!payload?.sub || !payload.email) {
    throw new Error('Could not read your Google account details from the token.')
  }
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture || null,
  }
}

// ─── Authorization-code flow (full redirect through accounts.google.com) ─────

export const GOOGLE_STATE_COOKIE = 'nuvia_g_state'

export const GOOGLE_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: 600, // 10 minutes — plenty for the round trip
  path: '/',
}

export function newGoogleState(): string {
  return randomBytes(24).toString('base64url')
}

/** The public origin of this deployment (behind proxies, trust forwarded headers). */
export function deriveOrigin(request: { headers: Headers | { get(name: string): string | null } }): string {
  const h = (name: string) => request.headers.get(name)
  const forwardedHost = h('x-forwarded-host')
  const host = forwardedHost || h('host') || 'localhost:3000'
  const proto = (h('x-forwarded-proto') || '').split(',')[0].trim() || (host.includes('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export function buildGoogleAuthorizeUrl(origin: string, state: string, clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    include_granted_scopes: 'true',
    prompt: 'select_account',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export interface GoogleCodeExchangeResult {
  sub: string
  email: string
  name: string
  picture: string | null
}

/** Exchange an authorization code for tokens and verify the returned id_token. */
export async function exchangeGoogleCode(
  code: string,
  origin: string,
  clientId: string,
  clientSecret: string
): Promise<GoogleCodeExchangeResult> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${origin}/api/auth/google/callback`,
    grant_type: 'authorization_code',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Google token exchange failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const tokens = (await res.json()) as { id_token?: string }
  if (!tokens.id_token) throw new Error('Google did not return an id_token')
  const profile = await verifyGoogleIdToken(tokens.id_token)
  return { sub: profile.sub, email: profile.email, name: profile.name, picture: profile.picture }
}

// ─── User upsert (find-or-create the Nuvia account for a Google identity) ────

export async function upsertGoogleUser(profile: GoogleProfile): Promise<SessionUser> {
  let user = null as Awaited<ReturnType<typeof db.user.findUnique>>
  try {
    user = await db.user.findUnique({ where: { email: profile.email } })
    if (!user) {
      user = await db.user.create({
        data: {
          name: profile.name,
          email: profile.email,
          provider: 'google',
          avatar: profile.picture,
          cycleLength: 28,
          periodLength: 5,
        },
      })
    } else {
      // A dicebear placeholder must never overwrite a real uploaded photo.
      const isPlaceholder = !!user.avatar && user.avatar.includes('dicebear')
      const nextAvatar = isPlaceholder && profile.picture ? profile.picture : profile.picture || user.avatar
      user = await db.user.update({
        where: { id: user.id },
        data: {
          provider: 'google',
          avatar: nextAvatar,
          name: profile.name || user.name,
        },
      })
    }
    return toSessionUser(user)
  } catch (dbError) {
    // DB unavailable — deterministic JWT-only session from Google's stable sub.
    console.warn(
      '[google-auth] DB unavailable, issuing JWT-only session:',
      dbError instanceof Error ? dbError.message : String(dbError)
    )
    return {
      id: `google-${profile.sub}`,
      name: profile.name,
      email: profile.email,
      avatar: profile.picture,
      provider: 'google',
      onboardingComplete: false,
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: null,
    }
  }
}
