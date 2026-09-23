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

// ─── seedCommunityIfEmpty ───────────────────────────────────────────────────
// Community demo content lives on the SHARED feed (visible to every user), so it
// is seeded once globally regardless of which user triggers the demo seed.
async function seedCommunityIfEmpty(): Promise<{ personas: number; posts: number; comments: number }> {
    const community = { personas: 0, posts: 0, comments: 0 }
    try {
      const existingPosts = await db.communityPost.count()
      if (existingPosts === 0) {
        const personaSpecs = [
          { email: 'meera.iyer@demo.nuvia.app', name: 'Meera Iyer' },
          { email: 'ananya.rao@demo.nuvia.app', name: 'Ananya Rao' },
          { email: 'fatima.sheikh@demo.nuvia.app', name: 'Fatima Sheikh' },
          { email: 'sara.thomas@demo.nuvia.app', name: 'Sara Thomas' },
          { email: 'kavya.nair@demo.nuvia.app', name: 'Kavya Nair' },
        ]
        const personas = []
        for (const spec of personaSpecs) {
          const persona = await db.user.upsert({
            where: { email: spec.email },
            update: {},
            create: { email: spec.email, name: spec.name, provider: 'demo', onboardingComplete: true },
          })
          personas.push(persona)
        }

        const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000)
        const postSpecs: Array<{
          personaIdx: number; title: string; content: string; category: string;
          likes: number; hours: number; isAnonymous: boolean;
          comments: Array<{ personaIdx: number; content: string; hours: number; isAnonymous: boolean }>;
        }> = [
          {
            personaIdx: 0,
            title: 'Cramps relief that actually worked for me 🔥',
            content: 'Tried the heating pad + gentle yoga combo the AI Coach suggested and my cramps went from 8/10 to 3/10 in two cycles. Anyone else found natural remedies that work?',
            category: 'general', likes: 24, hours: 5, isAnonymous: false,
            comments: [
              { personaIdx: 1, content: 'Yes! Raspberry leaf tea in the luteal phase has been a game changer for me too.', hours: 4, isAnonymous: false },
              { personaIdx: 2, content: 'Adding magnesium-rich foods (bananas, dark chocolate) helped mine a lot.', hours: 2, isAnonymous: true },
            ],
          },
          {
            personaIdx: 1,
            title: 'How do you track PCOS symptoms consistently?',
            content: 'I always start strong with logging and then fall off after a week. How do you all stay consistent with tracking? Any habits that stuck for you?',
            category: 'pcos', likes: 18, hours: 26, isAnonymous: true,
            comments: [
              { personaIdx: 3, content: 'I log right after brushing my teeth in the morning — attaching it to an existing habit was the trick.', hours: 20, isAnonymous: false },
              { personaIdx: 0, content: 'The daily reminders on this app helped me build a 30-day streak. Start with just mood + energy!', hours: 12, isAnonymous: false },
            ],
          },
          {
            personaIdx: 2,
            title: 'First time tracking my fertile window — questions!',
            content: 'Day 12 and my app says my fertile window opens tomorrow. For those TTC, do you rely on the predictions or do you also track BBT? Curious what worked for you.',
            category: 'fertility', likes: 31, hours: 47, isAnonymous: false,
            comments: [
              { personaIdx: 4, content: 'BBT confirmed what the predictions showed for me — using both gave me so much confidence.', hours: 40, isAnonymous: true },
              { personaIdx: 1, content: 'Cervical mucus tracking + the app window was my winning combo. Good luck! 🍀', hours: 33, isAnonymous: true },
            ],
          },
          {
            personaIdx: 3,
            title: 'Sleep and my cycle — the correlation is wild',
            content: 'I looked at my reports and my sleep quality drops 2 points in the luteal phase every single month. Finally makes sense why I feel wrecked before my period.',
            category: 'mental_health', likes: 42, hours: 70, isAnonymous: true,
            comments: [
              { personaIdx: 2, content: 'Same! Magnesium before bed + no screens after 10pm helped me a lot in that phase.', hours: 65, isAnonymous: false },
            ],
          },
          {
            personaIdx: 4,
            title: 'Doc appointment prep checklist — sharing what I learned',
            content: 'After 3 wasted visits, I finally learned: bring your symptom log, cycle history, and write your top 3 questions beforehand. My last appointment was 10x more productive.',
            category: 'general', likes: 57, hours: 96, isAnonymous: false,
            comments: [
              { personaIdx: 0, content: 'This is gold. The report export from this app is perfect for exactly this.', hours: 90, isAnonymous: true },
              { personaIdx: 3, content: 'Saving this for my annual checkup next month. Thank you!', hours: 80, isAnonymous: true },
              { personaIdx: 1, content: 'Also ask for your hormone panel numbers in writing — helped me get a second opinion later.', hours: 72, isAnonymous: false },
            ],
          },
        ]

        for (const spec of postSpecs) {
          const persona = personas[spec.personaIdx]
          const post = await db.communityPost.create({
            data: {
              userId: persona.id,
              title: spec.title,
              content: spec.content,
              category: spec.category,
              isAnonymous: spec.isAnonymous,
              likes: spec.likes,
              createdAt: hoursAgo(spec.hours),
            },
          })
          for (const c of spec.comments) {
            const cPersona = personas[c.personaIdx]
            await db.comment.create({
              data: {
                postId: post.id,
                userId: cPersona.id,
                content: c.content,
                isAnonymous: c.isAnonymous,
                createdAt: hoursAgo(c.hours),
              },
            })
            community.comments += 1
          }
          community.posts += 1
        }
        community.personas = personas.length
      }
    } catch (communityError) {
      // Community seeding is best-effort — never fail the whole seed for it.
      console.error('Community seed error:', communityError)
    }
  return community
}

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

    // Community demo content lives on the SHARED feed, so it must be seeded
    // even when the user already has cycle data (early return below).
    const community = await seedCommunityIfEmpty()

    const existingCycles = await db.cycle.count({ where: { userId } })
    if (existingCycles >= 3) {
      return NextResponse.json(
        { success: true, message: 'Demo data already present', seeded: false, community },
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
        ...community,
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
