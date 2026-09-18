import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { userId };
    if (status) {
      where.status = status;
    }

    const appointments = await db.appointment.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch appointments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      doctorName,
      specialty,
      date,
      time,
      type,
      notes,
    } = body;

    if (!userId || !doctorName || !date || !time) {
      return NextResponse.json(
        { error: 'userId, doctorName, date, and time are required' },
        { status: 400 }
      );
    }

    const validTypes = ['in_person', 'video', 'chat'];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const appointment = await db.appointment.create({
      data: {
        userId,
        doctorName,
        specialty: specialty ?? 'General',
        date,
        time,
        type: type ?? 'in_person',
        status: 'upcoming',
        notes,
      },
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    console.error('Error creating appointment:', error);
    return NextResponse.json(
      { error: 'Failed to create appointment' },
      { status: 500 }
    );
  }
}

// ─── PATCH: cancel an appointment (soft-cancel, ownership enforced) ─────────
// Body: { id: string, userId: string, action: 'cancel' }
export async function PATCH(request: NextRequest) {
  try {
    const { id, userId, action } = await request.json();

    if (!id || !userId || action !== 'cancel') {
      return NextResponse.json(
        { error: 'id, userId, and action "cancel" are required' },
        { status: 400 }
      );
    }

    const existing = await db.appointment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: 'You can only manage your own appointments' },
        { status: 403 }
      );
    }

    const appointment = await db.appointment.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    return NextResponse.json(appointment);
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    return NextResponse.json(
      { error: 'Failed to cancel appointment' },
      { status: 500 }
    );
  }
}

// ─── DELETE: permanently remove an appointment (ownership enforced) ─────────
// Query: id + userId
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id || !userId) {
      return NextResponse.json(
        { error: 'id and userId are required' },
        { status: 400 }
      );
    }

    const existing = await db.appointment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json(
        { error: 'You can only manage your own appointments' },
        { status: 403 }
      );
    }

    await db.appointment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    return NextResponse.json(
      { error: 'Failed to delete appointment' },
      { status: 500 }
    );
  }
}
