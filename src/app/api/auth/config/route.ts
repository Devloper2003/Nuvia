import { NextResponse } from 'next/server'
import { getGoogleClientId, isGoogleCodeFlowReady } from '@/lib/google-oauth'

// GET /api/auth/config — public bootstrap info for the auth screen.
// Exposes the Google OAuth client ID (a PUBLIC identifier, not a secret),
// whether Google sign-in is configured (env OR in-app Settings), and whether
// the full redirect flow (ID + secret) is available. Credentials themselves
// are never returned here.
export async function GET() {
  let clientId = ''
  let codeFlowReady = false
  try {
    clientId = await getGoogleClientId()
    codeFlowReady = await isGoogleCodeFlowReady()
  } catch {
    // DB hiccup — degrade to unconfigured rather than failing the screen
  }
  return NextResponse.json({
    google: {
      clientId,
      configured: !!clientId,
      codeFlowReady,
    },
  })
}
