import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── GET /api/reports/summary ────────────────────────────────────────────────
// Computes a full PeriodData report from the user's REAL logged data for the
// requested period (daily | weekly | monthly | annual), including a comparison
// against the equivalent previous period. Pure computation — no writes.
// Query: userId (required), period (default "weekly")

type Period = 'daily' | 'weekly' | 'monthly' | 'annual';

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().split('T')[0];

const MOOD_COLORS: Record<string, string> = {
  Happy: '#22c55e',
  Calm: '#14b8a6',
  Energetic: '#f59e0b',
  Tired: '#8b5cf6',
  Irritable: '#ef4444',
  Anxious: '#f97316',
  Sad: '#6366f1',
  Neutral: '#64748b',
};

const POSITIVE_MOODS = new Set(['Happy', 'Calm', 'Energetic']);

// Normalize user-entered mood labels ("happy", "HAPPY", "happy ") so they match
// the color map + positive-mood set. Keeps unknown labels readable.
function normalizeMood(mood: string): string {
  const trimmed = mood.trim();
  for (const known of Object.keys(MOOD_COLORS)) {
    if (known.toLowerCase() === trimmed.toLowerCase()) return known;
  }
  if (!trimmed) return 'Neutral';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function windowFor(period: Period): { days: number; label: string } {
  switch (period) {
    case 'daily': return { days: 1, label: 'Last 24 hours' };
    case 'weekly': return { days: 7, label: 'Last 7 days' };
    case 'monthly': return { days: 30, label: 'Last 30 days' };
    case 'annual': return { days: 365, label: 'Last 12 months' };
  }
}

interface SymptomRow { date: string; category: string; severity: number }
interface MoodRow { date: string; mood: string; energy: number; stress: number }
interface SleepRow { date: string; hoursSlept: number; quality: number }
interface WaterRow { date: string; glasses: number }
interface CycleRow {
  startDate: string; endDate: string | null; cycleLength: number;
  periodLength: number; ovulationDate: string | null;
  fertilityWindowStart: string | null; fertilityWindowEnd: string | null;
}

interface Metrics {
  symptomFrequency: { name: string; count: number }[];
  moodDistribution: { name: string; value: number; color: string }[];
  sleepAvg: number;
  waterAvg: number;
  symptomSeverity: number;   // 0-100 (avg severity / 5 * 100)
  moodStability: number;     // 0-100 (share of positive moods)
  wellnessScore: number;     // 0-100 weighted composite
  entryCount: number;
}

function computeMetrics(
  symptoms: SymptomRow[],
  moods: MoodRow[],
  sleeps: SleepRow[],
  waters: WaterRow[],
): Metrics {
  // Symptom frequency (top 6)
  const freq: Record<string, number> = {};
  let severitySum = 0;
  for (const s of symptoms) {
    freq[s.category] = (freq[s.category] ?? 0) + 1;
    severitySum += s.severity;
  }
  const symptomFrequency = Object.entries(freq)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const symptomSeverity = symptoms.length
    ? Math.round((severitySum / symptoms.length / 5) * 100)
    : 0;

  // Mood distribution
  const moodCounts: Record<string, number> = {};
  let positive = 0;
  let energySum = 0;
  let stressSum = 0;
  for (const m of moods) {
    const label = normalizeMood(m.mood);
    moodCounts[label] = (moodCounts[label] ?? 0) + 1;
    if (POSITIVE_MOODS.has(label)) positive += 1;
    energySum += m.energy ?? 0;
    stressSum += m.stress ?? 0;
  }
  const moodDistribution = Object.entries(moodCounts)
    .map(([name, value]) => ({ name, value, color: MOOD_COLORS[name] ?? '#94a3b8' }))
    .sort((a, b) => b.value - a.value);
  const moodStability = moods.length ? Math.round((positive / moods.length) * 100) : 0;
  const avgEnergy = moods.length ? energySum / moods.length : 0;
  const avgStress = moods.length ? stressSum / moods.length : 0;

  // Sleep + water
  const sleepAvg = sleeps.length
    ? Math.round((sleeps.reduce((t, s) => t + s.hoursSlept, 0) / sleeps.length) * 10) / 10
    : 0;
  const waterAvg = waters.length
    ? Math.round((waters.reduce((t, w) => t + w.glasses, 0) / waters.length) * 10) / 10
    : 0;

  // Wellness composite — weights normalize by whichever data exists
  const sleepScore = Math.min(100, Math.round((sleepAvg / 8) * 100));
  const waterScore = Math.min(100, Math.round((waterAvg / 8) * 100));
  const energyScore = Math.round((avgEnergy / 5) * 100);
  const stressScore = Math.round(100 - (avgStress / 5) * 100);
  const parts: Array<{ v: number; w: number }> = [];
  if (moods.length) {
    parts.push({ v: moodStability, w: 0.28 });
    parts.push({ v: energyScore, w: 0.12 });
    if (moods.some((m) => m.stress != null)) parts.push({ v: stressScore, w: 0.15 });
  }
  if (sleeps.length) parts.push({ v: sleepScore, w: 0.2 });
  if (waters.length) parts.push({ v: waterScore, w: 0.1 });
  if (symptoms.length) parts.push({ v: 100 - symptomSeverity, w: 0.15 });
  const wSum = parts.reduce((t, p) => t + p.w, 0);
  const wellnessScore = wSum
    ? Math.round(parts.reduce((t, p) => t + p.v * p.w, 0) / wSum)
    : 0;

  return {
    symptomFrequency,
    moodDistribution,
    sleepAvg,
    waterAvg,
    symptomSeverity,
    moodStability,
    wellnessScore,
    entryCount: symptoms.length + moods.length + sleeps.length + waters.length,
  };
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function trendLineFor(
  period: Period,
  start: Date,
  symptoms: SymptomRow[],
  moods: MoodRow[],
  sleeps: SleepRow[],
  waters: WaterRow[],
): { label: string; wellness: number; symptoms: number }[] {
  const byDate = <T extends { date: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const r of rows) {
      const list = map.get(r.date) ?? [];
      list.push(r);
      map.set(r.date, list);
    }
    return map;
  };
  const symMap = byDate(symptoms);
  const moodMap = byDate(moods);
  const sleepMap = byDate(sleeps);
  const waterMap = byDate(waters);

  const bucketMetrics = (from: Date, to: Date) => {
    const sym: SymptomRow[] = [];
    const mood: MoodRow[] = [];
    const sleep: SleepRow[] = [];
    const water: WaterRow[] = [];
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + DAY_MS)) {
      const key = iso(d);
      sym.push(...(symMap.get(key) ?? []));
      mood.push(...(moodMap.get(key) ?? []));
      sleep.push(...(sleepMap.get(key) ?? []));
      water.push(...(waterMap.get(key) ?? []));
    }
    const m = computeMetrics(sym, mood, sleep, water);
    return {
      wellness: m.wellnessScore,
      symptoms: m.symptomSeverity,
      hasData: m.entryCount > 0,
    };
  };

  const points: { label: string; wellness: number; symptoms: number }[] = [];

  if (period === 'annual') {
    for (let i = 11; i >= 0; i--) {
      const from = new Date(start.getFullYear(), start.getMonth() - i, 1);
      const to = new Date(from.getFullYear(), from.getMonth() + 1, 0);
      const m = bucketMetrics(from, to);
      points.push({
        label: from.toLocaleString('en-US', { month: 'short' }),
        wellness: m.wellness,
        symptoms: m.symptoms,
      });
    }
    return points;
  }

  const buckets =
    period === 'daily' ? 7 : period === 'weekly' ? 7 : 4; // daily/weekly → 7 days, monthly → 4 weeks
  const bucketDays = period === 'monthly' ? 7 : 1;
  // For daily/weekly the trend always shows the last 7 days for context.
  const trendStart =
    period === 'monthly'
      ? start
      : new Date(Date.now() - (buckets - 1) * DAY_MS);

  for (let i = 0; i < buckets; i++) {
    const from = new Date(trendStart.getTime() + i * bucketDays * DAY_MS);
    const to = new Date(from.getTime() + (bucketDays - 1) * DAY_MS);
    const m = bucketMetrics(from, to);
    if (period === 'monthly') {
      points.push({ label: `Wk ${i + 1}`, wellness: m.wellness, symptoms: m.symptoms });
    } else {
      const label = from.toLocaleDateString('en-US', { weekday: 'short' });
      points.push({
        label,
        wellness: m.hasData ? m.wellness : i === buckets - 1 ? m.wellness : points[i - 1]?.wellness ?? 0,
        symptoms: m.hasData ? m.symptoms : i === buckets - 1 ? m.symptoms : points[i - 1]?.symptoms ?? 0,
      });
    }
  }
  return points;
}

function cycleSummaryFor(cycles: CycleRow[], windowStart: string, windowEnd: string) {
  const items: { day: number; phase: string; note: string }[] = [];
  for (const c of cycles) {
    const start = new Date(c.startDate + 'T00:00:00');
    const ovul = c.ovulationDate ? new Date(c.ovulationDate + 'T00:00:00') : null;
    const fwS = c.fertilityWindowStart ? new Date(c.fertilityWindowStart + 'T00:00:00') : null;
    const end = c.endDate ? new Date(c.endDate + 'T00:00:00') : null;

    items.push({
      day: 1,
      phase: 'Menstrual',
      note: `Period started — ${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} (cycle length ${c.cycleLength}d)`,
    });
    if (end) {
      items.push({
        day: c.periodLength,
        phase: 'Menstrual',
        note: `Period ended after ${c.periodLength} days`,
      });
    }
    if (fwS) {
      items.push({
        day: Math.round((fwS.getTime() - start.getTime()) / DAY_MS) + 1,
        phase: 'Follicular',
        note: `Fertile window opened — ${fwS.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
      });
    }
    if (ovul) {
      items.push({
        day: Math.round((ovul.getTime() - start.getTime()) / DAY_MS) + 1,
        phase: 'Ovulation',
        note: `Predicted ovulation — ${ovul.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
      });
    }
  }
  return items
    .filter((it) => it.day >= 1)
    .sort((a, b) => a.day - b.day)
    .slice(0, 8);
}

function buildInsights(
  cur: Metrics,
  prev: Metrics,
  regularity: number,
  periodLabel: string,
): string[] {
  const out: string[] = [];

  if (cur.entryCount === 0) {
    return [
      `No entries logged in the ${periodLabel.toLowerCase()}. Log your mood, sleep, water, or symptoms and your personalized insights will appear here.`,
    ];
  }

  // Sleep
  if (cur.sleepAvg > 0) {
    const d = pctChange(cur.sleepAvg, prev.sleepAvg);
    const dir = d > 3 ? `up ${d}%` : d < -3 ? `down ${Math.abs(d)}%` : 'steady';
    const advice =
      cur.sleepAvg >= 7
        ? 'great — keep protecting your sleep window.'
        : cur.sleepAvg >= 6
          ? 'close to target. A consistent 7–8h schedule would boost energy further.'
          : 'below target. Try winding down 30 minutes earlier tonight.';
    out.push(`You averaged ${cur.sleepAvg}h of sleep (${dir} vs previous period) — ${advice}`);
  }

  // Hydration
  if (cur.waterAvg > 0) {
    const d = pctChange(cur.waterAvg, prev.waterAvg);
    const dir = d > 3 ? `up ${d}%` : d < -3 ? `down ${Math.abs(d)}%` : 'steady';
    const target = cur.waterAvg >= 8 ? 'on track with your hydration goal.' : `below the 8-glass target — carry a bottle to stay on track.`;
    out.push(`Hydration averaged ${cur.waterAvg} glasses/day (${dir}) — ${target}`);
  }

  // Symptoms
  if (cur.symptomFrequency.length > 0) {
    const top = cur.symptomFrequency[0];
    const d = pctChange(cur.symptomSeverity, prev.symptomSeverity);
    const dir = d > 5 ? `intensified by ${d}%` : d < -5 ? `eased by ${Math.abs(d)}%` : 'remained stable';
    out.push(`"${top.name}" was your most frequent symptom (${top.count} logs) and overall symptom severity ${dir} vs the previous period.`);
  }

  // Mood
  if (cur.moodDistribution.length > 0) {
    const dominant = cur.moodDistribution[0];
    const d = pctChange(cur.moodStability, prev.moodStability);
    const dir = d > 5 ? `improved by ${d}%` : d < -5 ? `dipped by ${Math.abs(d)}%` : 'held steady';
    out.push(`Your dominant mood was "${dominant.name}" (${dominant.value} logs) and mood stability ${dir}.`);
  }

  // Regularity
  if (regularity >= 75) {
    out.push(`Cycle regularity looks strong at ${regularity}%. Keep logging period start dates to maintain an accurate forecast.`);
  } else if (regularity > 0) {
    out.push(`Cycle regularity is around ${regularity}%. Variation is normal — flag big swings to your doctor if they persist for 3+ cycles.`);
  }

  // Overall wellness
  const wDiff = cur.wellnessScore - prev.wellnessScore;
  if (prev.entryCount > 0) {
    out.push(
      wDiff > 2
        ? `Overall wellness improved by ${wDiff} points vs the previous period — your habits are compounding. 🌙`
        : wDiff < -2
          ? `Overall wellness dipped ${Math.abs(wDiff)} points. Pick one metric (sleep, water, or mood) and focus there next week.`
          : `Overall wellness held steady at ${cur.wellnessScore}/100 — consistency is its own win.`,
    );
  }

  return out.slice(0, 6);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const period = (searchParams.get('period') ?? 'weekly') as Period;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (!['daily', 'weekly', 'monthly', 'annual'].includes(period)) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
    }

    const { days, label } = windowFor(period);
    const now = new Date();
    const curStart = new Date(now.getTime() - (days - 1) * DAY_MS);
    const curEnd = now;
    const prevStart = new Date(curStart.getTime() - days * DAY_MS);
    const prevEnd = new Date(curStart.getTime() - DAY_MS);

    const curStartIso = iso(curStart);
    const curEndIso = iso(curEnd);
    const prevStartIso = iso(prevStart);
    const prevEndIso = iso(prevEnd);

    // ─── Fetch all rows for both windows in parallel ─────────────────────────
    const [curSymptoms, curMoods, curSleeps, curWaters, prevSymptoms, prevMoods, prevSleeps, prevWaters, cycles] =
      await Promise.all([
        db.symptomEntry.findMany({ where: { userId, date: { gte: curStartIso, lte: curEndIso } } }),
        db.moodEntry.findMany({ where: { userId, date: { gte: curStartIso, lte: curEndIso } } }),
        db.sleepEntry.findMany({ where: { userId, date: { gte: curStartIso, lte: curEndIso } } }),
        db.waterEntry.findMany({ where: { userId, date: { gte: curStartIso, lte: curEndIso } } }),
        db.symptomEntry.findMany({ where: { userId, date: { gte: prevStartIso, lte: prevEndIso } } }),
        db.moodEntry.findMany({ where: { userId, date: { gte: prevStartIso, lte: prevEndIso } } }),
        db.sleepEntry.findMany({ where: { userId, date: { gte: prevStartIso, lte: prevEndIso } } }),
        db.waterEntry.findMany({ where: { userId, date: { gte: prevStartIso, lte: prevEndIso } } }),
        db.cycle.findMany({ where: { userId }, orderBy: { startDate: 'asc' } }),
      ]);

    const cur = computeMetrics(curSymptoms, curMoods, curSleeps, curWaters);
    const prev = computeMetrics(prevSymptoms, prevMoods, prevSleeps, prevWaters);

    // ─── Cycle regularity (std-dev of gaps between cycle starts) ──────────────
    let cycleRegularity = 0;
    if (cycles.length >= 2) {
      const recent = cycles.slice(-8);
      const gaps: number[] = [];
      for (let i = 1; i < recent.length; i++) {
        gaps.push(
          Math.round(
            (new Date(recent[i].startDate).getTime() -
              new Date(recent[i - 1].startDate).getTime()) / DAY_MS,
          ),
        );
      }
      const mean = gaps.reduce((t, g) => t + g, 0) / gaps.length;
      const variance = gaps.reduce((t, g) => t + (g - mean) ** 2, 0) / gaps.length;
      const stdDev = Math.sqrt(variance);
      cycleRegularity = Math.max(0, Math.min(100, Math.round(100 - stdDev * 12)));
    }

    const trendLine = trendLineFor(
      period, curStart, curSymptoms, curMoods, curSleeps, curWaters,
    );

    // Cycles overlapping the current window (for the cycle summary section)
    const overlapping = cycles.filter(
      (c) => c.startDate <= curEndIso && (c.endDate ?? c.startDate) >= curStartIso,
    );

    const report = {
      period: {
        type: period,
        label,
        startDate: curStartIso,
        endDate: curEndIso,
      },
      cycleRegularity,
      symptomSeverity: cur.symptomSeverity,
      moodStability: cur.moodStability,
      wellnessScore: cur.wellnessScore,
      prevCycleRegularity: cycleRegularity,
      prevSymptomSeverity: prev.symptomSeverity,
      prevMoodStability: prev.moodStability,
      prevWellnessScore: prev.wellnessScore,
      symptomFrequency: cur.symptomFrequency,
      moodDistribution: cur.moodDistribution,
      sleepAvg: cur.sleepAvg,
      waterAvg: cur.waterAvg,
      insights: buildInsights(cur, prev, cycleRegularity, label),
      trendLine,
      radarData: [
        { subject: 'Sleep', current: Math.min(100, Math.round((cur.sleepAvg / 8) * 100)), previous: Math.min(100, Math.round((prev.sleepAvg / 8) * 100)) },
        { subject: 'Hydration', current: Math.min(100, Math.round((cur.waterAvg / 8) * 100)), previous: Math.min(100, Math.round((prev.waterAvg / 8) * 100)) },
        { subject: 'Mood', current: cur.moodStability, previous: prev.moodStability },
        { subject: 'Symptoms', current: 100 - cur.symptomSeverity, previous: 100 - prev.symptomSeverity },
        { subject: 'Wellness', current: cur.wellnessScore, previous: prev.wellnessScore },
      ],
      cycleSummary: cycleSummaryFor(overlapping, curStartIso, curEndIso),
      counts: {
        symptoms: curSymptoms.length,
        moods: curMoods.length,
        sleeps: curSleeps.length,
        waters: curWaters.length,
      },
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error computing report summary:', error);
    return NextResponse.json(
      { error: 'Failed to compute report summary' },
      { status: 500 },
    );
  }
}
