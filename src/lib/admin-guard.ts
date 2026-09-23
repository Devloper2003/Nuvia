import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import type { AdminUser } from '@prisma/client'

// ─── Basement guard ──────────────────────────────────────────────────────────
// Shared protection for the hidden superadmin control centre ("the basement").
// Every basement endpoint MUST pass through requireSuperAdmin():
//   1. Bearer token (AdminSession, DB-backed, 24h TTL) from Authorization header
//   2. Session must be un-revoked and un-expired
//   3. The operator account must be active
//   4. The operator role must be super_admin
// Failures return a generic 401 — never leak whether the token, account, or
// role was the problem.

export async function requireSuperAdmin(request: NextRequest): Promise<AdminUser | null> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token || token.length < 32) return null

  const session = await db.adminSession.findUnique({
    where: { token },
    include: { admin: true },
  })
  if (!session || session.revoked || session.expiresAt < new Date()) return null
  if (!session.admin.active) return null
  if (session.admin.role !== 'super_admin') return null
  return session.admin
}

// ─── Login rate limiting (in-memory, per-IP) ────────────────────────────────
// Protects the admin gate from brute-force. Failed attempts accumulate per IP
// for a sliding window; once the cap is hit, logins are refused until the
// window clears. Successful sign-in resets the counter for that IP.
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_FAILED_ATTEMPTS = 6

const failures = new Map<string, { count: number; firstAt: number }>()

function clientKey(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for') ?? ''
  return (fwd.split(',')[0].trim() || request.headers.get('x-real-ip') || 'local').slice(0, 80)
}

export function loginThrottleStatus(request: NextRequest): { blocked: boolean; retryAfterSec: number } {
  const key = clientKey(request)
  const entry = failures.get(key)
  if (!entry) return { blocked: false, retryAfterSec: 0 }
  if (Date.now() - entry.firstAt > ATTEMPT_WINDOW_MS) {
    failures.delete(key)
    return { blocked: false, retryAfterSec: 0 }
  }
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    const retryAfterSec = Math.ceil((entry.firstAt + ATTEMPT_WINDOW_MS - Date.now()) / 1000)
    return { blocked: true, retryAfterSec }
  }
  return { blocked: false, retryAfterSec: 0 }
}

export function recordLoginFailure(request: NextRequest): void {
  const key = clientKey(request)
  const now = Date.now()
  const entry = failures.get(key)
  if (!entry || now - entry.firstAt > ATTEMPT_WINDOW_MS) {
    failures.set(key, { count: 1, firstAt: now })
    return
  }
  entry.count++
}

export function clearLoginFailures(request: NextRequest): void {
  failures.delete(clientKey(request))
}

// Best-effort periodic sweep so the map can't grow unbounded in long-lived
// processes. Cheap: runs at most once per minute on access.
let lastSweep = 0
export function sweepThrottleMap(): void {
  const now = Date.now()
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, entry] of failures) {
    if (now - entry.firstAt > ATTEMPT_WINDOW_MS) failures.delete(key)
  }
}
