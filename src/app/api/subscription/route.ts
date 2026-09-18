import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── GET /api/subscription?userId=... ────────────────────────────────────────
// Returns the user's active subscription (if any). Used to restore premium
// state on app load.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const subscription = await db.subscription.findFirst({
      where: { userId, status: 'active', endDate: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ active: !!subscription, subscription });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

// ─── POST /api/subscription ──────────────────────────────────────────────────
// Records a new subscription after a successful (sandbox/demo) checkout.
// Body: { userId, plan: 'monthly'|'yearly', tier: 'premium'|'plus',
//         amount, gst, total, currency?, transactionId?, paymentMethod? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      plan,
      tier,
      amount,
      gst,
      total,
      currency,
      transactionId,
      paymentMethod,
    } = body;

    if (!userId || !plan || !tier || amount == null) {
      return NextResponse.json(
        { error: 'userId, plan, tier, and amount are required' },
        { status: 400 }
      );
    }
    if (!['monthly', 'yearly'].includes(plan)) {
      return NextResponse.json(
        { error: 'plan must be "monthly" or "yearly"' },
        { status: 400 }
      );
    }
    if (!['basic', 'premium', 'plus'].includes(tier)) {
      return NextResponse.json(
        { error: 'tier must be "basic", "premium", or "plus"' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Expire any previous active subscriptions (single active subscription rule)
    await db.subscription.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'replaced' },
    });

    const now = new Date();
    const endDate = new Date(
      plan === 'monthly'
        ? now.getTime() + 30 * 86_400_000
        : now.getTime() + 365 * 86_400_000
    );

    const subscription = await db.subscription.create({
      data: {
        userId,
        plan,
        tier,
        amount,
        gst: gst ?? 0,
        total: total ?? amount,
        currency: currency ?? 'INR',
        status: 'active',
        startDate: now,
        endDate,
        paymentMethod: paymentMethod ?? 'paypal_sandbox',
        transactionId: transactionId ?? null,
        invoiceId: `CC-${Date.now().toString(36).toUpperCase()}`,
      },
    });

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/subscription?userId=... ─────────────────────────────────────
// Cancels the user's active subscription (keeps history for invoices).
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const result = await db.subscription.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'cancelled' },
    });

    return NextResponse.json({ success: true, cancelled: result.count });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
