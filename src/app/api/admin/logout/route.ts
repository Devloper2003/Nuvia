import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─── POST /api/admin/logout ──────────────────────────────────────────────────
// Revokes the caller's admin session (Bearer token).
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ error: 'Bearer token required' }, { status: 400 })
    }

    await db.adminSession.updateMany({
      where: { token, revoked: false },
      data: { revoked: true, revokedAt: new Date(), revokedReason: 'operator logout' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
