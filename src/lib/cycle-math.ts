// Shared cycle math — single source of truth for deriving the derived fields
// (ovulation date, fertile window) from a period start date.
// Used by POST /api/cycles and by the onboarding seeding in POST /api/user.

export interface DerivedCycleFields {
  cycleLength: number
  periodLength: number
  ovulationDate: string
  fertilityWindowStart: string
  fertilityWindowEnd: string
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function buildCycleFields(
  startDate: string,
  cycleLength?: number | null,
  periodLength?: number | null
): DerivedCycleFields {
  const effectiveCycleLength = cycleLength ?? 28
  const effectivePeriodLength = periodLength ?? 5

  // Ovulation date: cycleLength - 14 days from next period start
  // Next period start = startDate + cycleLength
  const periodStart = new Date(startDate)
  const nextPeriodStart = new Date(periodStart)
  nextPeriodStart.setDate(nextPeriodStart.getDate() + effectiveCycleLength)

  const ovulationDate = new Date(nextPeriodStart)
  ovulationDate.setDate(ovulationDate.getDate() - 14)

  // Fertile window: 5 days before ovulation through ovulation day
  const fertilityWindowStart = new Date(ovulationDate)
  fertilityWindowStart.setDate(fertilityWindowStart.getDate() - 5)

  return {
    cycleLength: effectiveCycleLength,
    periodLength: effectivePeriodLength,
    ovulationDate: toISODate(ovulationDate),
    fertilityWindowStart: toISODate(fertilityWindowStart),
    fertilityWindowEnd: toISODate(ovulationDate),
  }
}
