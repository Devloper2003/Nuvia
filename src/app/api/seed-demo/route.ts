import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─── POST /api/seed-demo ─────────────────────────────────────────────────────
// Seeds rich demo history for the signed-in user so charts, insights and the
// dashboard feel alive: 6 past cycles + 21 days of symptoms, mood, sleep and
// water entries. Refuses to double-seed if the user already has 3+ cycles.
const iso = (d: Date) => d.toISOString().split('T')[0]

const SYMPTOM_SAMPLES: Array<{ category: string; severity: number }> = [
  { category: 'Cramps', severity: 3 },
  { category: 'Headache', severity: 2 },
  { category: 'Bloating', severity: 2 },
  { category: 'Fatigue', severity: 3 },
  { category: 'Acne', severity: 1 },
  { category: 'Backache', severity: 2 },
  { category: 'Nausea', severity: 1 },
  { category: 'Cramps', severity: 2 },
  { category: 'Bloating', severity: 3 },
  { category: 'Headache', severity: 1 },
]

const MOOD_SAMPLES = ['Happy', 'Calm', 'Energetic', 'Tired', 'Irritable', 'Neutral', 'Anxious']
const NOTES = [
  'Felt a bit low in the evening',
  'Good energy after morning walk',
  'Slept late yesterday',
  null,
  'Drank more water today',
  null,
  'Mild cramps before noon',
]

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const existingCycles = await db.cycle.count({ where: { userId } })
    if (existingCycles >= 3) {
      return NextResponse.json(
        { success: true, message: 'Demo data already present', seeded: false },
        { status: 200 }
      )
    }

    const cycleLength = user.cycleLength || 28
    const periodLength = user.periodLength || 5
    const today = new Date()

    // ─── 6 historical cycles (ending 1 day before the user's current one) ──
    // Anchor on the user's real lastPeriodStart when available so the current
    // cycle stays consistent; go back 6 full cycles.
    const anchorStart = user.lastPeriodStart
      ? new Date(user.lastPeriodStart)
      : new Date(today.getTime() - 10 * 86_400_000)
    const cycleData: Array<{
      userId: string
      startDate: string
      endDate: string
      cycleLength: number
      periodLength: number
      ovulationDate: string
      fertilityWindowStart: string
      fertilityWindowEnd: string
    }> = []

    for (let i = 6; i >= 1; i--) {
      const start = new Date(anchorStart.getTime() - i * cycleLength * 86_400_000)
      const end = new Date(start.getTime() + (periodLength - 1) * 86_400_000)
      const ovulation = new Date(start.getTime() + Math.round(cycleLength * 0.5) * 86_400_000)
      const fwStart = new Date(ovulation.getTime() - 2 * 86_400_000)
      const fwEnd = new Date(ovulation.getTime() + 1 * 86_400_000)
      cycleData.push({
        userId,
        startDate: iso(start),
        endDate: iso(end),
        cycleLength,
        periodLength,
        ovulationDate: iso(ovulation),
        fertilityWindowStart: iso(fwStart),
        fertilityWindowEnd: iso(fwEnd),
      })
    }

    await db.cycle.createMany({ data: cycleData })

    // ─── 21 days of daily wellness entries ─────────────────────────────────
    const symptomEntries: Array<{
      userId: string
      date: string
      category: string
      severity: number
      notes: string | null
    }> = []
    const moodEntries: Array<{
      userId: string
      date: string
      mood: string
      energy: number
      stress: number
      notes: string | null
    }> = []
    const sleepEntries: Array<{
      userId: string
      date: string
      hoursSlept: number
      quality: number
      bedTime: string
      wakeTime: string
      notes: string | null
    }> = []
    const waterEntries: Array<{ userId: string; date: string; glasses: number }> = []

    for (let i = 20; i >= 0; i--) {
      const day = new Date(today.getTime() - i * 86_400_000)
      const dateStr = iso(day)
      const dayIdx = (20 - i) // stable pseudo-pattern
      const cycleDay = ((day.getTime() - anchorStart.getTime()) / 86_400_000) % cycleLength

      // Symptoms: heavier around the menstrual phase
      if (cycleDay < periodLength + 1 || dayIdx % 3 === 0) {
        const s = SYMPTOM_SAMPLES[dayIdx % SYMPTOM_SAMPLES.length]
        symptomEntries.push({
          userId,
          date: dateStr,
          category: s.category,
          severity: cycleDay < periodLength ? s.severity : Math.max(1, s.severity - 1),
          notes: NOTES[dayIdx % NOTES.length],
        })
      }

      // Mood: follicular → energetic, luteal → tired/irritable
      let mood = MOOD_SAMPLES[dayIdx % MOOD_SAMPLES.length]
      if (cycleDay > cycleLength - 8) mood = dayIdx % 2 === 0 ? 'Irritable' : 'Tired'
      else if (cycleDay < periodLength) mood = 'Tired'
      moodEntries.push({
        userId,
        date: dateStr,
        mood,
        energy: cycleDay > cycleLength - 8 ? 2 : Math.min(5, 3 + (dayIdx % 3)),
        stress: cycleDay > cycleLength - 8 ? 4 : 2,
        notes: NOTES[(dayIdx + 2) % NOTES.length],
      })

      // Sleep: 6–8.5h
      const hours = 6 + ((dayIdx * 7) % 25) / 10
      sleepEntries.push({
        userId,
        date: dateStr,
        hoursSlept: Math.round(hours * 2) / 2,
        quality: hours >= 7.5 ? 4 : hours >= 6.5 ? 3 : 2,
        bedTime: `23:${String(10 + (dayIdx % 40)).padStart(2, '0')}`,
        wakeTime: `0${6 + (dayIdx % 2)}:${String((dayIdx * 13) % 60).padStart(2, '0')}`,
        notes: null,
      })

      // Water: 4–9 glasses, gentle upward trend
      waterEntries.push({
        userId,
        date: dateStr,
        glasses: 4 + Math.floor((dayIdx % 6) + (20 - i) / 10),
      })
    }

    await db.symptomEntry.createMany({ data: symptomEntries })
    await db.moodEntry.createMany({ data: moodEntries })
    await db.sleepEntry.createMany({ data: sleepEntries })
    await db.waterEntry.createMany({ data: waterEntries })

    return NextResponse.json({
      success: true,
      seeded: true,
      summary: {
        cycles: cycleData.length,
        symptoms: symptomEntries.length,
        moods: moodEntries.length,
        sleeps: sleepEntries.length,
        water: waterEntries.length,
      },
    })
  } catch (error) {
    console.error('Seed demo error:', error)
    return NextResponse.json(
      { error: 'Failed to seed demo data' },
      { status: 500 }
    )
  }
}
