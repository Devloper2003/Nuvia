import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildCycleFields } from '@/lib/cycle-math';
import {
  getUserFromToken,
  parseCookies,
  SESSION_COOKIE,
} from '@/lib/auth';

// Session auth for mutating operations — same pattern as /api/user.
async function requireUserId(request: NextRequest): Promise<string | null> {
  const cookies = parseCookies(request.headers.get('cookie'));
  const headerToken = request.headers
    .get('authorization')
    ?.replace('Bearer ', '');
  const token = cookies[SESSION_COOKIE] || headerToken;
  if (!token) return null;
  const sessionUser = await getUserFromToken(token);
  return sessionUser?.id ?? null;
}

// Notes carry a flow prefix like "light flow." / "heavy flow. <free text>"
const FLOW_RE = /^(light|medium|heavy) flow\.?\s*/i;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const cycles = await db.cycle.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json(cycles);
  } catch (error) {
    console.error('Error fetching cycles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cycles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      startDate,
      endDate,
      cycleLength,
      periodLength,
      notes,
    } = body;

    if (!userId || !startDate) {
      return NextResponse.json(
        { error: 'userId and startDate are required' },
        { status: 400 }
      );
    }

    // Get user's cycle length for calculations
    const user = await db.user.findUnique({ where: { id: userId } });
    const effectiveCycleLength = cycleLength ?? user?.cycleLength ?? 28;
    const effectivePeriodLength = periodLength ?? user?.periodLength ?? 5;

    const derived = buildCycleFields(
      startDate,
      effectiveCycleLength,
      effectivePeriodLength
    );

    const cycle = await db.cycle.create({
      data: {
        userId,
        startDate,
        endDate,
        cycleLength: derived.cycleLength,
        periodLength: derived.periodLength,
        ovulationDate: derived.ovulationDate,
        fertilityWindowStart: derived.fertilityWindowStart,
        fertilityWindowEnd: derived.fertilityWindowEnd,
        notes,
      },
    });

    return NextResponse.json(cycle, { status: 201 });
  } catch (error) {
    console.error('Error creating cycle:', error);
    return NextResponse.json(
      { error: 'Failed to create cycle' },
      { status: 500 }
    );
  }
}

// PATCH /api/cycles — edit an owned cycle record (start/end date, flow, notes).
// If the edited record is (still) the user's newest cycle and its start date
// changed, user.lastPeriodStart is synced so Dashboard day/phase math and the
// Period Tracker stay consistent.
export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'You must be signed in to edit cycle records.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, startDate, endDate, flow, notes } = body as {
      id?: string;
      startDate?: string;
      endDate?: string | null;
      flow?: 'light' | 'medium' | 'heavy';
      notes?: string;
    };

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const existing = await db.cycle.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { error: 'Cycle record not found' },
        { status: 404 }
      );
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    const effectiveCycleLength = user?.cycleLength ?? 28;
    const effectivePeriodLength = user?.periodLength ?? 5;

    // Flow lives in the notes prefix; rewrite it when flow is provided.
    let nextNotes = existing.notes ?? '';
    if (flow) {
      nextNotes = `${flow} flow. ${nextNotes.replace(FLOW_RE, '')}`.trim();
    }
    if (typeof notes === 'string') {
      // Replace the free-text part after the flow prefix.
      const prefixMatch = nextNotes.match(FLOW_RE);
      nextNotes = `${prefixMatch ? prefixMatch[0] : ''}${notes}`.trim();
    }

    const nextStartDate =
      typeof startDate === 'string' && startDate
        ? startDate
        : existing.startDate;

    const derived = buildCycleFields(
      nextStartDate,
      existing.cycleLength ?? effectiveCycleLength,
      existing.periodLength ?? effectivePeriodLength
    );

    const updated = await db.cycle.update({
      where: { id },
      data: {
        startDate: nextStartDate,
        ...(endDate !== undefined ? { endDate } : {}),
        ovulationDate: derived.ovulationDate,
        fertilityWindowStart: derived.fertilityWindowStart,
        fertilityWindowEnd: derived.fertilityWindowEnd,
        notes: nextNotes || null,
      },
    });

    // Keep user.lastPeriodStart in sync when the newest cycle moved.
    if (nextStartDate !== existing.startDate) {
      const newest = await db.cycle.findFirst({
        where: { userId },
        orderBy: { startDate: 'desc' },
      });
      if (newest && newest.id === updated.id) {
        await db.user.update({
          where: { id: userId },
          data: { lastPeriodStart: nextStartDate },
        });
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating cycle:', error);
    return NextResponse.json(
      { error: 'Failed to update cycle' },
      { status: 500 }
    );
  }
}

// DELETE /api/cycles?id=... — remove an owned cycle record. If it was the
// user's newest cycle, user.lastPeriodStart falls back to the next-newest
// record (or null) so the Dashboard stops reporting a deleted period.
export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'You must be signed in to delete cycle records.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const existing = await db.cycle.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { error: 'Cycle record not found' },
        { status: 404 }
      );
    }

    await db.cycle.delete({ where: { id } });

    // Fall back to the newest remaining cycle when the deleted one was newest.
    const wasNewest =
      (await db.cycle.count({
        where: { userId, startDate: { gt: existing.startDate } },
      })) === 0;
    if (wasNewest) {
      const nextNewest = await db.cycle.findFirst({
        where: { userId },
        orderBy: { startDate: 'desc' },
      });
      await db.user.update({
        where: { id: userId },
        data: { lastPeriodStart: nextNewest?.startDate ?? null },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cycle:', error);
    return NextResponse.json(
      { error: 'Failed to delete cycle' },
      { status: 500 }
    );
  }
}
