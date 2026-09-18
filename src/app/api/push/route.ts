import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getVapidPublicKey, isPushConfigured, sendPushToUser } from '@/lib/push'

// ─── GET /api/push?userId=xxx — public key + subscription status ─────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  let subscribed = false
  if (userId) {
    const count = await db.pushSubscription.count({ where: { userId } })
    subscribed = count > 0
  }

  return NextResponse.json({
    configured: isPushConfigured(),
    publicKey: getVapidPublicKey(),
    subscribed,
  })
}

// ─── POST /api/push — register (or refresh) a push subscription ──────────────
// Body: { userId, subscription: { endpoint, keys: { p256dh, auth } } }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, subscription } = body as {
      userId: string
      subscription?: {
        endpoint?: string
        keys?: { p256dh?: string; auth?: string }
      }
    }

    if (!userId || !subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { error: 'userId and a full subscription (endpoint + keys) are required' },
        { status: 400 }
      )
    }

    const saved = await db.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: request.headers.get('user-agent')?.slice(0, 255) ?? null,
      },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    })

    return NextResponse.json({ success: true, id: saved.id }, { status: 201 })
  } catch (error) {
    console.error('Error saving push subscription:', error)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }
}

// ─── DELETE /api/push — remove a subscription (unsubscribe) ──────────────────
// Body: { endpoint } or query ?endpoint=
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let endpoint = searchParams.get('endpoint')
    if (!endpoint) {
      const body = await request.json().catch(() => ({}))
      endpoint = body.endpoint
    }
    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint is required' }, { status: 400 })
    }

    await db.pushSubscription.deleteMany({ where: { endpoint } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing push subscription:', error)
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
  }
}

// ─── PUT /api/push — send a test push to all of a user's devices ─────────────
// Body: { userId }
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const result = await sendPushToUser(userId, {
      title: '🔔 Nuvia reminders are live',
      body: 'You will be notified before your period, about appointments and community activity. This is a test notification.',
      tag: 'chandracycle-test',
      url: '/dashboard',
      type: 'test',
    })

    if (result.total === 0) {
      return NextResponse.json(
        { error: 'No active device subscriptions found for this user' },
        { status: 404 }
      )
    }
    if (result.sent === 0) {
      return NextResponse.json(
        {
          error: `Push service rejected all ${result.total} subscription(s) — they may be stale; try re-enabling reminders`,
          ...result,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      ...result,
      message: `Test notification sent to ${result.sent} device(s)`,
    })
  } catch (error) {
    console.error('Error sending test push:', error)
    return NextResponse.json({ error: 'Failed to send test notification' }, { status: 500 })
  }
}
