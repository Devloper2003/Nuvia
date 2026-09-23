import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'

// ─── POST /api/admin/login ───────────────────────────────────────────────────
// Operator sign-in for the in-app moderation console. Verifies credentials
// against the AdminUser table and issues a DB-backed AdminSession token
// (24h TTL) that moderation endpoints require as a Bearer token.
//
// First-run bootstrap: if the AdminUser table is empty, a default operator is
// provisioned (admin@nuvia.app / nuvia-admin) so the moderation
// console is usable out of the box in this sandbox deployment.
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'email and password are required' },
        { status: 400 }
      )
    }

    // One-time bootstrap of the default operator account.
    const adminCount = await db.adminUser.count()
    if (adminCount === 0) {
      const { hashPassword } = await import('@/lib/auth')
      await db.adminUser.create({
        data: {
          email: 'admin@nuvia.app',
          name: 'Nuvia Admin',
          passwordHash: await hashPassword('nuvia-admin'),
          role: 'super_admin',
        },
      })
    }

    const admin = await db.adminUser.findUnique({
      where: { email: email.trim().toLowerCase() },
    })

    if (!admin || !admin.active) {
      return NextResponse.json(
        { error: 'Invalid admin credentials' },
        { status: 401 }
      )
    }

    const passwordOk = await verifyPassword(password, admin.passwordHash)
    if (!passwordOk) {
      return NextResponse.json(
        { error: 'Invalid admin credentials' },
        { status: 401 }
      )
    }

    // Create a DB-backed session valid for 24 hours.
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await db.adminSession.create({
      data: {
        token,
        adminId: admin.id,
        expiresAt,
        ipAddress: request.headers.get('x-forwarded-for') ?? null,
      },
    })

    // Housekeeping: drop this admin's expired sessions.
    await db.adminSession.deleteMany({
      where: { adminId: admin.id, expiresAt: { lt: new Date() } },
    })

    await db.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      token,
      expiresAt: expiresAt.toISOString(),
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    })
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json(
      { error: 'Admin login failed' },
      { status: 500 }
    )
  }
}
