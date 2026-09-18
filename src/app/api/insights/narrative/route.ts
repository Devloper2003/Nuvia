import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─── POST /api/insights/narrative ────────────────────────────────────────────
// LLM-generated wellness narrative for the dashboard "AI Insights" card.
// Unlike the rule-based strings in /api/reports/summary, this builds a compact
// digest from the user's REAL last-7-days logs and asks the LLM for a warm,
// personalised 3–4 sentence summary + one concrete focus tip.
//
// Caching: the generated narrative is stored in the SiteSetting key-value
// table under `narrative:{userId}:{weekKey}` with a 6-hour TTL so the AI runs
// at most 4×/day/user. `force: true` bypasses the cache (Regenerate button).

const CACHE_TTL_MS = 6 * 60 * 60 * 1000

interface Digest {
  name: string
  cycleDay: number | null
  cycleLength: number | null
  phase: string
  sleepAvg: number | null
  waterAvg: number | null
  moodCounts: Record<string, number>
  energyAvg: number | null
  stressAvg: number | null
  topSymptoms: Array<{ category: string; count: number; avgSeverity: number }>
  loggedDays: number
}

async function buildDigest(userId: string): Promise<Digest | null> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return null

  const today = new Date()
  const weekAgo = new Date(today.getTime() - 7 * 86_400_000)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]

  const [symptoms, moods, sleeps, waters, latestCycle] = await Promise.all([
    db.symptomEntry.findMany({ where: { userId, date: { gte: weekAgoStr } } }),
    db.moodEntry.findMany({ where: { userId, date: { gte: weekAgoStr } }, orderBy: { date: 'asc' } }),
    db.sleepEntry.findMany({ where: { userId, date: { gte: weekAgoStr } } }),
    db.waterEntry.findMany({ where: { userId, date: { gte: weekAgoStr } } }),
    db.cycle.findFirst({ where: { userId }, orderBy: { startDate: 'desc' } }),
  ])

  // Cycle day / phase
  let cycleDay: number | null = null
  let cycleLength: number | null = user.cycleLength || null
  let phase = 'unknown'
  if (latestCycle) {
    cycleLength = latestCycle.cycleLength || cycleLength || 28
    cycleDay = Math.max(
      1,
      Math.floor((today.getTime() - new Date(latestCycle.startDate).getTime()) / 86_400_000) + 1
    )
    if (cycleDay > cycleLength) cycleDay = ((cycleDay - 1) % cycleLength) + 1
    if (cycleDay <= 5) phase = 'Menstrual'
    else if (cycleDay <= 13) phase = 'Follicular'
    else if (cycleDay <= 16) phase = 'Ovulation'
    else phase = 'Luteal'
  }

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null

  const moodCounts: Record<string, number> = {}
  for (const m of moods) {
    const key = m.mood?.trim().toLowerCase() || 'unknown'
    moodCounts[key] = (moodCounts[key] ?? 0) + 1
  }

  const symptomMap: Record<string, { count: number; severitySum: number }> = {}
  for (const s of symptoms) {
    const entry = symptomMap[s.category] ?? { count: 0, severitySum: 0 }
    entry.count += 1
    entry.severitySum += s.severity ?? 1
    symptomMap[s.category] = entry
  }

  const loggedDays = new Set([
    ...moods.map((m) => m.date),
    ...sleeps.map((s) => s.date),
    ...symptoms.map((s) => s.date),
  ]).size

  return {
    name: user.name?.split(' ')[0] ?? 'there',
    cycleDay,
    cycleLength,
    phase,
    sleepAvg: avg(sleeps.map((s) => s.hoursSlept)),
    waterAvg: avg(waters.map((w) => w.glasses)),
    moodCounts,
    energyAvg: avg(moods.map((m) => m.energy)),
    stressAvg: avg(moods.map((m) => m.stress)),
    topSymptoms: Object.entries(symptomMap)
      .map(([category, v]) => ({
        category,
        count: v.count,
        avgSeverity: Math.round((v.severitySum / v.count) * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4),
    loggedDays,
  }
}

function digestToPrompt(d: Digest): string {
  const moodSummary = Object.entries(d.moodCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([mood, count]) => `${mood}×${count}`)
    .join(', ')
  const symptoms = d.topSymptoms.length
    ? d.topSymptoms.map((s) => `${s.category} (${s.count}×, avg severity ${s.avgSeverity}/5)`).join(', ')
    : 'none logged'

  return `User health digest (last 7 days):
- Name: ${d.name}
- Cycle: day ${d.cycleDay ?? '?'} of ${d.cycleLength ?? '?'} (${d.phase} phase)
- Sleep: ${d.sleepAvg ?? 'no data'} h/night average
- Hydration: ${d.waterAvg ?? 'no data'} glasses/day average
- Moods: ${moodSummary || 'no data'}
- Energy avg: ${d.energyAvg ?? 'no data'}/5, Stress avg: ${d.stressAvg ?? 'no data'}/5
- Symptoms: ${symptoms}
- Days with any logging: ${d.loggedDays}/7`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, force } = body

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const digest = await buildDigest(userId)
    if (!digest) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Users with no logging at all get the empty-state signal instead of an
    // AI paragraph about nothing.
    if (digest.loggedDays === 0 && digest.cycleDay === null) {
      return NextResponse.json({ narrative: null, reason: 'no-data' })
    }

    // ─── Cache lookup (weekly bucket = current ISO week start) ─────────────
    const now = new Date()
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
    const cacheKey = `narrative:${userId}:${weekStart.toISOString().split('T')[0]}`

    if (!force) {
      const cached = await db.siteSetting.findUnique({ where: { key: cacheKey } })
      if (cached) {
        try {
          const parsed = JSON.parse(cached.value) as { text: string; createdAt: number }
          if (Date.now() - parsed.createdAt < CACHE_TTL_MS) {
            return NextResponse.json({
              narrative: parsed.text,
              cached: true,
              generatedAt: new Date(parsed.createdAt).toISOString(),
            })
          }
        } catch {
          // corrupted cache entry — regenerate below
        }
      }
    }

    // ─── LLM generation ────────────────────────────────────────────────────
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content:
            "You are ChandraCycle's AI health companion writing a short, warm weekly summary for the app dashboard. " +
            'Rules: 3-4 sentences maximum, then exactly one actionable focus tip on its own line starting with "Focus tip:". ' +
            'Reference the user by first name once. Mention at least one positive pattern and one gentle improvement area. ' +
            'Never diagnose, never use medical jargon, never invent numbers that are not in the digest. ' +
            'If a metric has no data, skip it gracefully instead of calling that out. ' +
            'Tone: encouraging, specific, human. No emojis, no markdown headings, no bullet lists.',
        },
        {
          role: 'user',
          content: `${digestToPrompt(digest)}\n\nWrite this week's narrative summary for ${digest.name}.`,
        },
      ],
      thinking: { type: 'disabled' },
    })

    const narrative = completion.choices?.[0]?.message?.content?.trim()
    if (!narrative) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    // Cache (best-effort)
    try {
      await db.siteSetting.upsert({
        where: { key: cacheKey },
        update: { value: JSON.stringify({ text: narrative, createdAt: Date.now() }) },
        create: { key: cacheKey, value: JSON.stringify({ text: narrative, createdAt: Date.now() }) },
      })
    } catch (cacheErr) {
      console.error('Narrative cache write failed:', cacheErr)
    }

    return NextResponse.json({
      narrative,
      cached: false,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Narrative generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate narrative' },
      { status: 500 }
    )
  }
}
