import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/admin-guard'

// ─── helpers ─────────────────────────────────────────────────────────────────
function mask(secret: string | null | undefined): string | null {
  if (!secret) return null
  if (secret.length <= 8) return '••••••••'
  return `${secret.slice(0, 6)}••••••••${secret.slice(-4)}`
}

async function auditLog(adminId: string, adminName: string, action: string, label: string, details: string, ip: string | null) {
  await db.auditLog.create({
    data: { adminId, adminName, action, targetType: 'payment', targetId: null, targetLabel: label, details, ipAddress: ip },
  }).catch(() => {})
}

// ─── GET /api/admin/payments ─────────────────────────────────────────────────
// Gateway config (secrets masked) + transactions + summary.
// Optional ?sync=1 → live handshake with the configured gateway (Razorpay).
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const wantsSync = searchParams.get('sync') === '1'
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null

  let config = await db.paymentConfig.findFirst({ orderBy: { createdAt: 'asc' } })

  // ── Gateway sync: live API handshake (Razorpay today, more later) ──
  let sync: { attempted: boolean; ok: boolean; message: string } = { attempted: false, ok: false, message: 'Sync not requested' }
  if (wantsSync) {
    sync = { attempted: true, ok: false, message: 'No gateway configured yet.' }
    if (config && config.gateway === 'razorpay' && config.apiKey && config.apiSecret) {
      try {
        const auth = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')
        const res = await fetch('https://api.razorpay.com/v1/payments?count=1', {
          headers: { Authorization: `Basic ${auth}` },
          signal: AbortSignal.timeout(12000),
        })
        if (res.ok) {
          sync = { attempted: true, ok: true, message: 'Handshake OK — credentials are live and valid.' }
        } else if (res.status === 401) {
          sync = { attempted: true, ok: false, message: 'Gateway rejected the credentials (401). Check key/secret.' }
        } else {
          sync = { attempted: true, ok: false, message: `Gateway responded HTTP ${res.status}.` }
        }
      } catch {
        sync = { attempted: true, ok: false, message: 'Could not reach the gateway (network/timeout).' }
      }
      config = await db.paymentConfig.update({
        where: { id: config.id },
        data: { lastSyncedAt: new Date(), lastSyncStatus: sync.ok ? 'success' : 'failed', lastSyncMessage: sync.message },
      })
      await auditLog(admin.id, admin.name, 'payments:sync', config.displayName, `${sync.ok ? 'OK' : 'FAILED'} — ${sync.message}`, ip)
    }
  }

  const transactions = await db.paymentTransaction.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  const agg = await db.paymentTransaction.aggregate({
    where: { status: { in: ['captured', 'paid', 'success'] } },
    _sum: { amount: true }, _count: { _all: true },
  })
  const refunded = await db.paymentTransaction.aggregate({
    where: { status: { in: ['refunded', 'refund'] } },
    _sum: { amount: true }, _count: { _all: true },
  })

  return NextResponse.json({
    config: config
      ? {
          id: config.id, gateway: config.gateway, displayName: config.displayName,
          apiKey: mask(config.apiKey), apiSecret: config.apiSecret ? '••••••••' : null,
          merchantId: config.merchantId, webhookSecret: config.webhookSecret ? '••••••••' : null,
          webhookUrl: config.webhookUrl, paymentLinkUrl: config.paymentLinkUrl,
          successUrl: config.successUrl, failureUrl: config.failureUrl,
          mode: config.mode, active: config.active, currency: config.currency,
          lastSyncedAt: config.lastSyncedAt, lastSyncStatus: config.lastSyncStatus, lastSyncMessage: config.lastSyncMessage,
        }
      : null,
    transactions,
    summary: {
      capturedTotal: Math.round(agg._sum.amount ?? 0),
      capturedCount: agg._count._all,
      refundedTotal: Math.round(refunded._sum.amount ?? 0),
      refundedCount: refunded._count._all,
      txnCount: transactions.length,
    },
    sync,
  })
}

// ─── PUT /api/admin/payments ─────────────────────────────────────────────────
// Body: { gateway, displayName?, mode?, currency?, apiKey?, apiSecret?, merchantId?, webhookSecret?, webhookUrl?, paymentLinkUrl?, successUrl?, failureUrl?, active? }
// Secrets left blank ("") keep the stored value; "-clear" wipes them.
export async function PUT(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const b = await request.json()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null

    const existing = await db.paymentConfig.findFirst({ orderBy: { createdAt: 'asc' } })
    const data: Record<string, unknown> = {
      gateway: ['razorpay', 'paypal', 'stripe', 'cashfree'].includes(b.gateway) ? b.gateway : 'razorpay',
    }
    if (b.displayName !== undefined) data.displayName = String(b.displayName).slice(0, 60) || 'Razorpay'
    if (['test', 'live'].includes(b.mode)) data.mode = b.mode
    if (typeof b.currency === 'string' && b.currency.length === 3) data.currency = b.currency.toUpperCase()
    if (b.active !== undefined) data.active = b.active === true

    const secretFields: [string, string][] = [
      ['apiKey', 'apiKey'], ['apiSecret', 'apiSecret'], ['merchantId', 'merchantId'],
      ['webhookSecret', 'webhookSecret'],
    ]
    for (const [field, column] of secretFields) {
      if (typeof b[field] === 'string' && b[field].length > 0) {
        if (b[field] === '-clear') data[column] = null
        else data[column] = b[field].trim().slice(0, 200)
      }
    }
    for (const field of ['webhookUrl', 'paymentLinkUrl', 'successUrl', 'failureUrl']) {
      if (b[field] !== undefined) data[field] = b[field] ? String(b[field]).slice(0, 300) : null
    }

    const config = existing
      ? await db.paymentConfig.update({ where: { id: existing.id }, data })
      : await db.paymentConfig.create({ data: data as { [K: string]: never } })

    await auditLog(admin.id, admin.name, 'payments:config', config.displayName,
      `gateway=${config.gateway} · mode=${config.mode}${data.apiKey ? ' · key updated' : ''}${data.apiSecret ? ' · secret updated' : ''}`, ip)

    return NextResponse.json({
      success: true,
      config: {
        ...config,
        apiKey: mask(config.apiKey), apiSecret: config.apiSecret ? '••••••••' : null,
        webhookSecret: config.webhookSecret ? '••••••••' : null,
      },
    })
  } catch (error) {
    console.error('Payment config error:', error)
    return NextResponse.json({ error: 'Failed to save gateway config' }, { status: 500 })
  }
}

// ─── POST /api/admin/payments ────────────────────────────────────────────────
// Manual ledger entry. Body: { userEmail, userName?, amount, status?, method?, description? }
export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const b = await request.json()
    const amount = Number(b.amount)
    const userEmail = String(b.userEmail ?? '').trim().toLowerCase()
    if (!userEmail || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'userEmail and a positive amount are required' }, { status: 400 })
    }

    const txn = await db.paymentTransaction.create({
      data: {
        txnId: b.txnId ? String(b.txnId).slice(0, 100) : `manual-${Date.now()}`,
        userEmail,
        userName: b.userName ? String(b.userName).slice(0, 100) : null,
        amount: Math.round(amount * 100) / 100,
        currency: typeof b.currency === 'string' && b.currency.length === 3 ? b.currency.toUpperCase() : 'INR',
        status: ['created', 'captured', 'paid', 'success', 'failed', 'refunded'].includes(b.status) ? b.status : 'captured',
        method: b.method ? String(b.method).slice(0, 40) : 'manual',
        gateway: 'manual',
        description: b.description ? String(b.description).slice(0, 300) : 'Recorded from HQ console',
        syncedAt: new Date(),
      },
    })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    await auditLog(admin.id, admin.name, 'payments:record', userEmail, `₹${txn.amount} · ${txn.status}`, ip)

    return NextResponse.json({ success: true, transaction: txn })
  } catch (error) {
    console.error('Payment record error:', error)
    return NextResponse.json({ error: 'Failed to record transaction' }, { status: 500 })
  }
}

// ─── PATCH /api/admin/payments ───────────────────────────────────────────────
// Update a transaction's status (refund / mark failed / reconcile).
// Body: { id, status, errorMsg? }
export async function PATCH(request: NextRequest) {
  const admin = await requireSuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const b = await request.json()
    const { id, status } = b
    if (!id || !['created', 'captured', 'paid', 'success', 'failed', 'refunded'].includes(status)) {
      return NextResponse.json({ error: 'id and a valid status are required' }, { status: 400 })
    }

    const txn = await db.paymentTransaction.update({
      where: { id },
      data: { status, errorMsg: b.errorMsg ? String(b.errorMsg).slice(0, 300) : undefined },
    })

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    await auditLog(admin.id, admin.name, 'payments:status', txn.userEmail ?? txn.txnId ?? id, `status → ${status}`, ip)

    return NextResponse.json({ success: true, transaction: txn })
  } catch (error) {
    console.error('Payment patch error:', error)
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
  }
}
