'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { useLanguage } from '@/components/language-provider'
import type { TranslationKey } from '@/lib/i18n/translations'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts'
import {
  Droplets,
  CalendarDays,
  Sparkles,
  Sun,
  CloudSun,
  Moon,
  HeartPulse,
  GlassWater,
  TrendingUp,
  Zap,
  Plus,
  Bell,
  Activity,
  Baby,
  Flower2,
  Clock,
  Video,
  MapPin,
  MessageCircle,
  Stethoscope,
  X,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

// ─── Animation Variants ──────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

// ─── Empty State Component ───────────────────────────────────────────────────

interface EmptyStateProps {
  icon: React.ElementType
  title: string
  description: string
  ctaLabel?: string
  onCta?: () => void
  className?: string
}

function EmptyState({ icon: Icon, title, description, ctaLabel, onCta, className }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${
        className ?? ''
      }`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      {ctaLabel && onCta && (
        <Button size="sm" className="mt-4" onClick={onCta}>
          {ctaLabel}
        </Button>
      )}
    </div>
  )
}

// ─── Phase metadata (configuration — not user data) ──────────────────────────

const PHASE_META = [
  { name: 'Menstrual', key: 'phase.menstrual' as TranslationKey, days: '1-5', color: '#e11d48' },
  { name: 'Follicular', key: 'phase.follicular' as TranslationKey, days: '6-13', color: '#8b5cf6' },
  { name: 'Ovulation', key: 'phase.ovulation' as TranslationKey, days: '14-16', color: '#f97316' },
  { name: 'Luteal', key: 'phase.luteal' as TranslationKey, days: '17-28', color: '#06b6d4' },
]

function getPhaseForCycleDay(cycleDay: number, cycleLength: number, periodLength: number) {
  // Period phase
  if (cycleDay <= periodLength) {
    return PHASE_META[0]
  }
  // Ovulation is roughly 14 days before next period
  const ovulationDay = cycleLength - 14
  if (cycleDay >= ovulationDay - 1 && cycleDay <= ovulationDay + 1) {
    return PHASE_META[2]
  }
  if (cycleDay < ovulationDay - 1) {
    return PHASE_META[1]
  }
  return PHASE_META[3]
}

// ─── Main Component ──────────────────────────────────────────────────────────

// ─── Reminder helpers ────────────────────────────────────────────────────────

function formatReminderDate(isoDate: string): string {
  const todayIso = new Date().toISOString().split('T')[0]
  const tomorrowIso = new Date(Date.now() + 86_400_000).toISOString().split('T')[0]
  if (isoDate === todayIso) return 'Today'
  if (isoDate === tomorrowIso) return 'Tomorrow'
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

function appointmentTypeMeta(type: string): { icon: React.ElementType; label: string } {
  switch (type.toLowerCase()) {
    case 'video':
      return { icon: Video, label: 'Video consult' }
    case 'chat':
      return { icon: MessageCircle, label: 'Chat consult' }
    case 'in_person':
    case 'in-person':
    case 'consultation':
      return { icon: Stethoscope, label: 'In-person visit' }
    default:
      return { icon: CalendarDays, label: 'Appointment' }
  }
}

// ─── Hormone educational curves ────────────────────────────────────────────
// Cosine easing over t∈[0,1]
function ease(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return 0.5 - 0.5 * Math.cos(Math.PI * clamped)
}

function buildHormoneCurves(cycleLength: number) {
  const ovul = Math.max(10, cycleLength - 14)
  const points: Array<{ day: number; label: string; estrogen: number; progesterone: number }> = []
  for (let d = 1; d <= cycleLength; d++) {
    // Estrogen: low during period → follicular rise → ovulation peak → dip →
    // secondary luteal bump → premenstrual fall
    let estrogen: number
    if (d <= ovul) {
      estrogen = 15 + 75 * ease((d - 3) / (ovul - 3))
    } else if (d <= ovul + 2) {
      estrogen = 90 - 55 * ease((d - ovul) / 2)
    } else if (d <= ovul + 8) {
      estrogen = 35 + 22 * ease((d - ovul - 2) / 6)
    } else {
      estrogen = 57 - 40 * ease((d - ovul - 8) / Math.max(1, cycleLength - ovul - 8))
    }
    // Progesterone: flat low until ovulation → strong luteal rise → fall
    let progesterone: number
    if (d <= ovul) {
      progesterone = 12
    } else if (d <= ovul + 7) {
      progesterone = 12 + 73 * ease((d - ovul) / 7)
    } else {
      progesterone = 85 - 70 * ease((d - ovul - 7) / Math.max(1, cycleLength - ovul - 7))
    }
    points.push({
      day: d,
      label: d === 1 || d % 7 === 0 || d === cycleLength ? `D${d}` : '',
      estrogen: Math.round(estrogen),
      progesterone: Math.round(progesterone),
    })
  }
  return { points, ovul }
}

const emptySubscribe = () => () => {}

interface CycleEntry {
  id: string
  startDate: string
  endDate?: string | null
  cycleLength: number
  periodLength: number
  ovulationDate?: string | null
  fertilityWindowStart?: string | null
  fertilityWindowEnd?: string | null
  notes?: string | null
}

export default function DashboardModule() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  const userProfile = useAppStore((s) => s.userProfile)
  const setActiveModule = useAppStore((s) => s.setActiveModule)
  const { t, lang } = useLanguage()
  const displayName = userProfile?.name?.trim() || 'there'

  const [cycles, setCycles] = useState<CycleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [weeklySymptoms, setWeeklySymptoms] = useState<
    Array<{ day: string; count: number; label: string }>
  >([])
  const [recentActivity, setRecentActivity] = useState<
    Array<{ id: string; label: string; detail: string; dateLabel: string; kind: string }>
  >([])
  const [reminders, setReminders] = useState<
    Array<{ id: string; doctorName: string; specialty: string; date: string; time: string; type: string }>
  >([])
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [weeklyInsights, setWeeklyInsights] = useState<string[]>([])
  const [wellnessScore, setWellnessScore] = useState<number | null>(null)
  const [narrative, setNarrative] = useState<string | null>(null)
  const [narrativeTip, setNarrativeTip] = useState<string | null>(null)
  const [narrativeLoading, setNarrativeLoading] = useState(false)
  const [narrativeCached, setNarrativeCached] = useState(false)
  // Typewriter rendering of the narrative
  const [narrativeTyped, setNarrativeTyped] = useState('')
  const [typingDone, setTypingDone] = useState(false)
  const hadNarrativeRef = useRef(false)

  // Type the narrative out progressively whenever a new one arrives.
  useEffect(() => {
    if (!narrative) {
      setNarrativeTyped('')
      setTypingDone(false)
      return
    }
    setNarrativeTyped('')
    setTypingDone(false)
    // Respect reduced-motion preferences: show the full text immediately.
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setNarrativeTyped(narrative)
      setTypingDone(true)
      return
    }
    let i = 0
    // Finish in roughly 150 ticks (~2.4s at 16ms) regardless of length.
    const step = Math.max(2, Math.ceil(narrative.length / 150))
    const timer = setInterval(() => {
      i += step
      if (i >= narrative.length) {
        setNarrativeTyped(narrative)
        setTypingDone(true)
        clearInterval(timer)
      } else {
        setNarrativeTyped(narrative.slice(0, i))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [narrative])

  // ─── LLM weekly narrative (cached server-side, 6h TTL) ─────────────────────
  const loadNarrative = useCallback(
    async (force = false) => {
    if (!userProfile?.id) return
    setNarrativeLoading(true)
    try {
      const res = await fetch('/api/insights/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userProfile.id, force }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Narrative failed')
      if (data.narrative) {
        // Split the "Focus tip:" out of the narrative body. The LLM usually
        // puts it on its own line, but sometimes inline at the end — handle
        // both by splitting on the first occurrence anywhere in the text.
        const raw = String(data.narrative)
        const match = raw.match(/focus\s+tip\s*:\s*/i)
        let body = raw
        let tip: string | null = null
        if (match && match.index !== undefined) {
          body = raw.slice(0, match.index).trim()
          tip = raw.slice(match.index + match[0].length).trim()
        }
        body = body.replace(/\s+/g, ' ').trim()
        setNarrative(body || null)
        setNarrativeTip(tip)
        setNarrativeCached(Boolean(data.cached))
        if (force && hadNarrativeRef.current) {
          toast.success('Your weekly summary was updated ✨')
        }
        hadNarrativeRef.current = true
      }
    } catch {
      // Narrative is best-effort — the rule-based insights below still show.
    } finally {
      setNarrativeLoading(false)
    }
    },
    [userProfile?.id]
  )

  useEffect(() => {
    if (!userProfile?.id) {
      // Defer to avoid cascading renders (react-hooks/set-state-in-effect)
      let cancelled = false
      Promise.resolve().then(() => { if (!cancelled) setLoading(false) })
      return () => { cancelled = true }
    }
    let cancelled = false
    fetch(`/api/cycles?userId=${encodeURIComponent(userProfile.id)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CycleEntry[]) => {
        if (!cancelled) {
          setCycles(Array.isArray(data) ? data : [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userProfile?.id])

  // ─── Weekly symptoms + recent activity (real data) ─────────────────────────
  useEffect(() => {
    if (!userProfile?.id) return
    let cancelled = false

    const daysAgoIso = (n: number) => {
      const d = new Date()
      d.setDate(d.getDate() - n)
      return d.toISOString().split('T')[0]
    }
    const last7 = Array.from({ length: 7 }, (_, i) => daysAgoIso(6 - i))

    const loadWellness = async () => {
      try {
        const [symRes, moodRes, sleepRes, waterRes] = await Promise.all([
          fetch(`/api/symptoms?userId=${encodeURIComponent(userProfile.id)}`),
          fetch(`/api/mood?userId=${encodeURIComponent(userProfile.id)}`),
          fetch(`/api/sleep?userId=${encodeURIComponent(userProfile.id)}`),
          fetch(`/api/water?userId=${encodeURIComponent(userProfile.id)}`),
        ])
        if (cancelled) return
        const symptoms = symRes.ok ? await symRes.json() : []
        const moods = moodRes.ok ? await moodRes.json() : []
        const sleeps = sleepRes.ok ? await sleepRes.json() : []
        const waters = waterRes.ok ? await waterRes.json() : []

        // Upcoming appointments → reminders
        try {
          const apptRes = await fetch(`/api/appointments?userId=${encodeURIComponent(userProfile.id)}`)
          if (!cancelled && apptRes.ok) {
            const appts = await apptRes.json()
            const todayIso = new Date().toISOString().split('T')[0]
            setReminders(
              (Array.isArray(appts) ? appts : [])
                .filter((a: { date: string; status?: string }) => a.date >= todayIso && a.status !== 'cancelled')
                .slice(0, 3)
                .map((a: { id: string; doctorName: string; specialty: string; date: string; time: string; type: string }) => ({
                  id: a.id,
                  doctorName: a.doctorName,
                  specialty: a.specialty,
                  date: a.date,
                  time: a.time,
                  type: a.type,
                }))
            )
          }
        } catch {
          // reminders are best-effort
        }

        // Weekly wellness insights (same aggregation the Reports module uses)
        try {
          const repRes = await fetch(
            `/api/reports/summary?userId=${encodeURIComponent(userProfile.id)}&period=weekly`
          )
          if (!cancelled && repRes.ok) {
            const rep = await repRes.json()
            setWeeklyInsights(Array.isArray(rep.insights) ? rep.insights.slice(0, 3) : [])
            setWellnessScore(typeof rep.wellnessScore === 'number' ? rep.wellnessScore : null)
          }
        } catch {
          // insights are best-effort
        }

        // LLM narrative for this week (server-cached, cheap to auto-load)
        loadNarrative()

        // Weekly symptoms bar chart (last 7 days)
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        setWeeklySymptoms(
          last7.map((date) => {
            const d = new Date(date + 'T00:00:00')
            return {
              day: dayNames[d.getDay()],
              label: date,
              count: (Array.isArray(symptoms) ? symptoms : []).filter(
                (s: { date: string }) => s.date === date
              ).length,
            }
          })
        )

        // Recent activity feed — merge latest logs, newest first
        type Entry = { date: string; createdAt?: string }
        const mk = <T extends Entry>(
          arr: T[] | undefined,
          kind: string,
          fn: (item: T) => { label: string; detail: string }
        ) =>
          (Array.isArray(arr) ? arr : []).slice(0, 5).map((item) => ({
            id: `${kind}-${item.date}-${Math.random().toString(36).slice(2, 7)}`,
            kind,
            dateLabel: item.date,
            ...fn(item),
          }))

        const merged = [
          ...mk(symptoms, 'symptom', (s: { category: string; severity?: number }) => ({
            label: s.category || 'Symptom',
            detail: s.severity ? `Severity ${s.severity}/5` : 'Logged',
          })),
          ...mk(moods, 'mood', (m: { mood: string; energy?: number }) => ({
            label: m.mood || 'Mood logged',
            detail: m.energy ? `Energy ${m.energy}/5` : 'Daily check-in',
          })),
          ...mk(sleeps, 'sleep', (s: { hoursSlept: number; quality?: number }) => ({
            label: `${s.hoursSlept}h sleep`,
            detail: s.quality ? `Quality ${s.quality}/5` : 'Logged',
          })),
          ...mk(waters, 'water', (w: { glasses: number }) => ({
            label: `${w.glasses} glasses of water`,
            detail: 'Hydration logged',
          })),
        ]
          .sort((a, b) => (a.dateLabel < b.dateLabel ? 1 : -1))
          .slice(0, 6)
          .map((item) => {
            const todayIso = new Date().toISOString().split('T')[0]
            const yesterdayIso = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
            return {
              ...item,
              dateLabel:
                item.dateLabel === todayIso
                  ? 'Today'
                  : item.dateLabel === yesterdayIso
                    ? 'Yesterday'
                    : item.dateLabel,
            }
          })

        setRecentActivity(merged)
      } catch {
        // best-effort — leave empty states visible
      }
    }

    loadWellness()
    return () => {
      cancelled = true
    }
  }, [userProfile?.id])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return t('greeting.morning')
    if (hour < 17) return t('greeting.afternoon')
    return t('greeting.evening')
  }, [t])

  const localeMap: Record<string, string> = { en: 'en-US', hi: 'hi-IN', ta: 'ta-IN' }
  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString(localeMap[lang] ?? 'en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }, [lang])

  const greetingIcon = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return Sun
    if (hour < 17) return CloudSun
    return Moon
  }, [])

  const GreetingIcon = greetingIcon

  // ─── Cancel an appointment (optimistic + revert on failure) ────────────────
  const handleCancelAppointment = async (appointmentId: string) => {
    if (!userProfile?.id) return
    const prev = reminders
    setCancellingId(appointmentId)
    // optimistic removal
    setReminders((rs) => rs.filter((r) => r.id !== appointmentId))
    try {
      const res = await fetch('/api/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appointmentId, userId: userProfile.id, action: 'cancel' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success('Appointment cancelled')
    } catch {
      setReminders(prev)
      toast.error('Could not cancel the appointment. Please try again.')
    } finally {
      setCancellingId(null)
    }
  }

  // Compute current cycle day from latest cycle (or user's lastPeriodStart)
  const cycleInfo = useMemo(() => {
    const latest = cycles[0]
    const refStart = latest?.startDate ?? userProfile?.lastPeriodStart
    if (!refStart) return null
    const start = new Date(refStart)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    start.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const cycleLength = latest?.cycleLength ?? userProfile?.cycleLength ?? 28
    const periodLength = latest?.periodLength ?? userProfile?.periodLength ?? 5
    if (diffDays < 1) return null
    const cycleDay = ((diffDays - 1) % cycleLength) + 1
    return {
      cycleDay,
      cycleLength,
      periodLength,
      daysUntilPeriod: cycleLength - cycleDay,
      phase: getPhaseForCycleDay(cycleDay, cycleLength, periodLength),
      startDate: refStart,
    }
  }, [cycles, userProfile])

  const quickLogButtons = [
    {
      icon: Droplets,
      labelKey: 'quicklog.period' as TranslationKey,
      color: 'bg-rose-500 hover:bg-rose-600',
      textColor: 'text-white',
      module: 'period' as const,
    },
    {
      icon: Sparkles,
      labelKey: 'quicklog.mood' as TranslationKey,
      color: 'bg-purple-500 hover:bg-purple-600',
      textColor: 'text-white',
      module: 'mental' as const,
    },
    {
      icon: HeartPulse,
      labelKey: 'quicklog.symptoms' as TranslationKey,
      color: 'bg-pink-500 hover:bg-pink-600',
      textColor: 'text-white',
      module: 'symptoms' as const,
    },
    {
      icon: GlassWater,
      labelKey: 'quicklog.water' as TranslationKey,
      color: 'bg-sky-500 hover:bg-sky-600',
      textColor: 'text-white',
      module: 'fitness' as const,
    },
    {
      icon: Moon,
      labelKey: 'quicklog.sleep' as TranslationKey,
      color: 'bg-indigo-500 hover:bg-indigo-600',
      textColor: 'text-white',
      module: 'fitness' as const,
    },
  ]

  if (!mounted || loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-muted rounded-lg" />
        <div className="h-72 bg-muted rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ─── 1. Welcome Header ──────────────────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GreetingIcon className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl sm:text-3xl font-bold">
              <span className="gradient-text">{greeting}</span>, {displayName}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">{formattedDate}</p>
        </div>
        {cycleInfo && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs font-medium">
              <Droplets className="h-3 w-3 text-rose-500" />
              {t('dashboard.dayOfCycle', { day: cycleInfo.cycleDay })}
            </Badge>
            <Badge
              className="gap-1.5 px-3 py-1 text-xs font-semibold text-white border-0"
              style={{ backgroundColor: cycleInfo.phase.color }}
            >
              <Sparkles className="h-3 w-3" />
              {t('dashboard.phaseBadge', { phase: t(cycleInfo.phase.key) })}
            </Badge>
          </div>
        )}
      </motion.div>

      {/* ─── 2. Cycle Status Hero Card ──────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass overflow-hidden border-0 shadow-lg">
          <CardContent className="p-6">
            {cycleInfo ? (
              <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-8">
                {/* Circular Progress Ring */}
                <div className="flex-shrink-0">
                  <CycleProgressRing
                    cycleDay={cycleInfo.cycleDay}
                    cycleLength={cycleInfo.cycleLength}
                    periodLength={cycleInfo.periodLength}
                    phaseColor={cycleInfo.phase.color}
                    phaseName={t(cycleInfo.phase.key)}
                    ofDaysLabel={t('dashboard.ofDays', { n: cycleInfo.cycleLength })}
                  />
                </div>

                {/* Phase Info */}
                <div className="flex-1 text-center lg:text-left space-y-4 w-full">
                  <div>
                    <h2 className="text-xl font-bold mb-1">
                      {t('dashboard.inYourPhase')}{' '}
                      <span style={{ color: cycleInfo.phase.color }} className="font-extrabold">
                        {t(cycleInfo.phase.key)}
                      </span>{' '}
                      {t('dashboard.phaseSuffix')}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {t('dashboard.phaseHint')}
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                    <div className="text-center px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/30">
                      <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                        {cycleInfo.daysUntilPeriod}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('dashboard.daysUntilPeriod')}</p>
                    </div>
                    <div className="text-center px-4 py-2 rounded-xl bg-orange-50 dark:bg-orange-950/30">
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {(() => {
                          // Ovulation typically occurs 14 days before the next period.
                          const ovulationDay = cycleInfo.cycleLength - 14
                          let daysToOvulation = ovulationDay - cycleInfo.cycleDay
                          if (daysToOvulation < 0) {
                            // Already passed this cycle — show days until next ovulation
                            daysToOvulation += cycleInfo.cycleLength
                          }
                          return Math.max(0, daysToOvulation)
                        })()}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('dashboard.daysToOvulation')}</p>
                    </div>
                  </div>

                  {/* Phase Breakdown Legend */}
                  <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                    {PHASE_META.map((phase) => (
                      <div key={phase.name} className="flex items-center gap-1.5 text-xs">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: phase.color }}
                        />
                        <span className="text-muted-foreground">
                          {t(phase.key)} <span className="font-medium text-foreground">({phase.days})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Droplets}
                title={t('dashboard.noCycleTitle')}
                description="Log your first period start date to unlock cycle predictions, fertility windows, and phase insights."
                ctaLabel={t('dashboard.logFirstPeriod')}
                onCta={() => setActiveModule('period')}
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── 3. Quick Stats Row ─────────────────────────────────────────────── */}
      {cycleInfo && (
        <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(() => {
            // Ovulation typically occurs 14 days before the next period (same
            // math as the cycle card) — surfaced here so the "Next ovulation"
            // stat is a live estimate instead of a dead dash.
            const ovulationDay = cycleInfo.cycleLength - 14
            let daysToOvulation = ovulationDay - cycleInfo.cycleDay
            if (daysToOvulation < 0) daysToOvulation += cycleInfo.cycleLength
            daysToOvulation = Math.max(0, daysToOvulation)
            const ovulationDate = new Date(Date.now() + daysToOvulation * 86_400_000)
            const fertility =
              cycleInfo.phase.name === 'Ovulation'
                ? { value: t('fertility.peak'), subtitle: t('fertility.highChance') }
                : cycleInfo.phase.name === 'Follicular'
                  ? { value: t('fertility.rising'), subtitle: t('fertility.risingChance') }
                  : { value: t('fertility.low'), subtitle: t('fertility.lowChance') }
            return [
              {
                title: t('dashboard.cycleDay'),
                value: cycleInfo.cycleDay,
                subtitle: t('dashboard.ofDays', { n: cycleInfo.cycleLength }),
                icon: CalendarDays,
                color: 'text-rose-500',
                bg: 'bg-rose-50 dark:bg-rose-950/30',
                badge: { text: t(cycleInfo.phase.key), bg: cycleInfo.phase.color },
              },
              {
                title: t('dashboard.daysUntilPeriodTitle'),
                value: cycleInfo.daysUntilPeriod,
                subtitle: t('dashboard.countdown'),
                icon: Clock,
                color: 'text-purple-500',
                bg: 'bg-purple-50 dark:bg-purple-950/30',
                badge: null,
              },
              {
                title: t('dashboard.fertilityStatus'),
                value: fertility.value,
                subtitle: fertility.subtitle,
                icon: Baby,
                color: 'text-orange-500',
                bg: 'bg-orange-50 dark:bg-orange-950/30',
                badge:
                  cycleInfo.phase.name === 'Ovulation'
                    ? { text: t('fertility.peak'), bg: '#e11d48' }
                    : null,
              },
              {
                title: t('dashboard.nextOvulation'),
                value: daysToOvulation,
                subtitle: `≈ ${ovulationDate.toLocaleDateString(localeMap[lang] ?? 'en-US', { month: 'short', day: 'numeric' })} · ${t('dashboard.dayCycle', { n: cycleInfo.cycleLength })}`,
                icon: Flower2,
                color: 'text-emerald-500',
                bg: 'bg-emerald-50 dark:bg-emerald-950/30',
                badge: null,
              },
            ].map((stat) => (
              <Card
                key={stat.title}
                className="glass border-0 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group/card"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg ${stat.bg} transition-transform duration-200 group-hover/card:scale-110`}>
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                    {stat.badge && (
                      <Badge
                        className="text-white border-0 text-[10px] px-2 py-0.5"
                        style={{ backgroundColor: stat.badge.bg }}
                      >
                        {stat.badge.text}
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold tabular-nums">
                    {typeof stat.value === 'number' ? <AnimatedNumber value={stat.value} /> : stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.subtitle}</p>
                </CardContent>
              </Card>
            ))
          })()}
        </motion.div>
      )}

      {/* ─── 4. Hormone Preview — educational curves from your cycle data ───── */}
      <motion.div variants={itemVariants}>
        <Card className="glass border-0 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-rose-500" />
                <CardTitle className="text-base">Hormone Preview</CardTitle>
              </div>
              <Badge variant="outline" className="text-[9px] uppercase tracking-wide text-muted-foreground">
                Educational
              </Badge>
            </div>
            <CardDescription>
              {cycles.length > 0 && cycleInfo
                ? `Estrogen & progesterone pattern for your ${cycleInfo.cycleLength}-day cycle`
                : 'Your hormone patterns will appear here once you have cycle data.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cycles.length === 0 || !cycleInfo ? (
              <EmptyState
                icon={Activity}
                title="No hormone insights yet"
                description="Log a couple of cycles and ChandraCycle will visualize your estrogen and progesterone patterns across your cycle."
                ctaLabel="Log your period"
                onCta={() => setActiveModule('period')}
              />
            ) : (
              <HormoneCurves cycleLength={cycleInfo.cycleLength} cycleDay={cycleInfo.cycleDay} />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── 5. AI Insights Section — empty until user logs data ────────────── */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">AI Insights for Your Phase</h2>
          <Badge variant="secondary" className="text-[10px]">
            Powered by AI
          </Badge>
        </div>
        <Card className="glass border-0 shadow-lg">
          <CardContent className="p-0">
            {weeklyInsights.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Personalized insights coming soon"
                description="Once you start logging your cycle, mood, and symptoms, ChandraCycle's AI will surface personalized recommendations for your current phase."
                ctaLabel="Start tracking"
                onCta={() => setActiveModule('period')}
              />
            ) : (
              <div className="p-4 space-y-2.5">
                {wellnessScore !== null && (
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-0 text-[11px] h-6">
                      Wellness score {wellnessScore}/100
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">this week</span>
                  </div>
                )}

                {/* ─── LLM weekly narrative ─────────────────────────────── */}
                {narrativeLoading && !narrative ? (
                  <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/5 via-transparent to-fuchsia-500/5 p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      ChandraCycle AI is reading your week…
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 rounded-full bg-muted animate-pulse w-11/12" />
                      <div className="h-3 rounded-full bg-muted animate-pulse w-4/5" />
                      <div className="h-3 rounded-full bg-muted animate-pulse w-2/3" />
                    </div>
                  </div>
                ) : narrative ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45 }}
                    className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/5 via-transparent to-fuchsia-500/5 p-4 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                          Weekly AI summary
                        </span>
                        {narrativeCached && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-muted-foreground border-muted-foreground/30">
                            cached
                          </Badge>
                        )}
                      </div>
                      <button
                        onClick={() => loadNarrative(true)}
                        disabled={narrativeLoading}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                        aria-label="Regenerate AI summary"
                      >
                        {narrativeLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        Regenerate
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground min-h-[2.5rem]">
                      {narrativeTyped}
                      {!typingDone && (
                        <span
                          aria-hidden
                          className="ml-0.5 inline-block h-3 w-[2px] translate-y-[2px] rounded-sm bg-primary animate-pulse"
                        />
                      )}
                    </p>
                    {narrativeTip && typingDone && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                        className="mt-3 flex items-start gap-2 rounded-lg bg-primary/8 dark:bg-primary/10 border border-primary/15 p-2.5"
                      >
                        <Zap className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed text-foreground/90">
                          <span className="font-semibold">Focus tip:</span> {narrativeTip}
                        </p>
                      </motion.div>
                    )}
                    {typingDone && (
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        onClick={() => setActiveModule('ai-coach')}
                        className="mt-2.5 text-[10px] font-medium text-primary hover:underline"
                      >
                        Continue the conversation in AI Coach →
                      </motion.button>
                    )}
                  </motion.div>
                ) : null}

                {weeklyInsights.map((insight, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.08 }}
                    className="flex items-start gap-2.5 p-3 rounded-xl border bg-white/60 dark:bg-white/5"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed text-foreground">{insight}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── 6. Quick Log ───────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass border-0 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Quick Log</CardTitle>
            </div>
            <CardDescription>Track your health in one tap</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {quickLogButtons.map((btn, i) => (
                <motion.button
                  key={btn.labelKey}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: i * 0.06,
                    type: 'spring',
                    stiffness: 400,
                    damping: 20,
                  }}
                  className={`${btn.color} ${btn.textColor} rounded-xl p-4 flex flex-col items-center justify-center gap-2 shadow-md hover:shadow-lg transition-shadow cursor-pointer`}
                  aria-label={t(btn.labelKey)}
                  onClick={() => setActiveModule(btn.module)}
                >
                  <btn.icon className="h-6 w-6" />
                  <span className="text-xs font-semibold">{t(btn.labelKey)}</span>
                </motion.button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── 7. Weekly Symptoms Chart — real data ───────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass border-0 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-pink-500" />
              <CardTitle className="text-base">Weekly Symptoms</CardTitle>
            </div>
            <CardDescription>Symptoms logged over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {weeklySymptoms.every((d) => d.count === 0) ? (
              <EmptyState
                icon={HeartPulse}
                title="No symptoms logged this week"
                description="Tap a symptom in the Symptoms Tracker to start building your weekly pattern chart."
                ctaLabel="Log a symptom"
                onCta={() => setActiveModule('symptoms')}
              />
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklySymptoms} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [`${value} logged`, 'Symptoms']}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #fecdd3',
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[6, 6, 0, 0]}
                      fill="url(#symptomGradient)"
                      maxBarSize={36}
                    />
                    <defs>
                      <linearGradient id="symptomGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ec4899" />
                        <stop offset="100%" stopColor="#fb7185" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── 8. Upcoming Reminders — empty ──────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass border-0 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base">Upcoming Reminders</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {reminders.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No reminders set"
                description="Book an appointment in Find Doctor and it will show up here automatically."
                ctaLabel="Find a doctor"
                onCta={() => setActiveModule('doctors')}
              />
            ) : (
              <div className="space-y-2">
                {reminders.map((r) => {
                  const { icon: TypeIcon, label: typeLabel } = appointmentTypeMeta(r.type)
                  const isToday = r.date === new Date().toISOString().split('T')[0]
                  const isCancelling = cancellingId === r.id
                  return (
                    <div
                      key={r.id}
                      className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all hover:shadow-sm ${
                        isToday
                          ? 'bg-amber-100/70 dark:bg-amber-950/30 border-amber-300/70 dark:border-amber-800/60'
                          : 'bg-amber-50/60 dark:bg-amber-950/20 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                        <TypeIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate flex items-center gap-1.5">
                          {r.doctorName.startsWith('Dr.') ? r.doctorName : `Dr. ${r.doctorName}`}
                          <span className="text-muted-foreground">— {r.specialty}</span>
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          {typeLabel}
                          {isToday && (
                            <Badge className="bg-amber-500 text-white border-0 text-[9px] h-4 px-1.5 uppercase tracking-wide">
                              Today
                            </Badge>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                          {formatReminderDate(r.date)}
                        </p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">{r.time}</p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            aria-label={`Cancel appointment with ${r.doctorName}`}
                            disabled={isCancelling}
                            className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all disabled:cursor-not-allowed"
                          >
                            {isCancelling ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {r.doctorName.startsWith('Dr.') ? r.doctorName : `Dr. ${r.doctorName}`} —{' '}
                              {r.specialty} on {formatReminderDate(r.date)} at {r.time}. The slot will be
                              released and the appointment removed from your reminders.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep appointment</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-white hover:bg-destructive/90"
                              onClick={() => handleCancelAppointment(r.id)}
                            >
                              Cancel appointment
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── 9. Recent Activity Feed — real data ────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass border-0 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <EmptyState
                icon={Plus}
                title="No activity yet"
                description="Your recent logs — periods, moods, symptoms, sleep, water — will show up here. Start tracking to see your timeline."
                ctaLabel="Log your first entry"
                onCta={() => setActiveModule('period')}
              />
            ) : (
              <div className="space-y-2">
                {recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border bg-white/60 dark:bg-white/5 px-3 py-2.5 hover:shadow-sm transition-shadow"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        item.kind === 'symptom'
                          ? 'bg-pink-100 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400'
                          : item.kind === 'mood'
                            ? 'bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400'
                            : item.kind === 'sleep'
                              ? 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                              : 'bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400'
                      }`}
                    >
                      {item.kind === 'symptom' ? (
                        <HeartPulse className="h-4 w-4" />
                      ) : item.kind === 'mood' ? (
                        <Sparkles className="h-4 w-4" />
                      ) : item.kind === 'sleep' ? (
                        <Moon className="h-4 w-4" />
                      ) : (
                        <GlassWater className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{item.dateLabel}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Bottom spacer for scroll ───────────────────────────────────────── */}
      <div className="h-4" />
    </motion.div>
  )
}

// ─── Hormone Curves Chart (educational) ──────────────────────────────────────

/**
 * Count-up number animation for dashboard stats. Animates from the previous
 * value to the new one with an ease-out cubic; renders the final value
 * instantly when the user prefers reduced motion.
 */
function AnimatedNumber({ value, duration = 900 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const prev = useRef(0)

  useEffect(() => {
    // Reduced motion → jump straight to the value (still via rAF so no
    // synchronous setState inside the effect body).
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const from = reduce ? value : prev.current
    const start = performance.now()
    const dur = reduce ? 0 : duration
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        prev.current = value
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <>{display}</>
}

function HormoneCurves({ cycleLength, cycleDay }: { cycleLength: number; cycleDay: number }) {
  const { points, ovul } = useMemo(() => buildHormoneCurves(cycleLength), [cycleLength])

  return (
    <div>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="estrogenFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="progesteroneFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.24} />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              labelFormatter={(l) => {
                const p = points.find((pt) => pt.label === l)
                return p ? `Day ${p.day}` : String(l)
              }}
              formatter={(value: number | string, name: string) => [
                `${value}`, name === 'estrogen' ? 'Estrogen' : 'Progesterone',
              ]}
              contentStyle={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="estrogen"
              stroke="#f43f5e"
              strokeWidth={2}
              fill="url(#estrogenFill)"
              dot={false}
              name="estrogen"
            />
            <Area
              type="monotone"
              dataKey="progesterone"
              stroke="#06b6d4"
              strokeWidth={2}
              fill="url(#progesteroneFill)"
              dot={false}
              name="progesterone"
            />
            <ReferenceLine
              x={`D${cycleDay}`}
              stroke="var(--foreground)"
              strokeDasharray="4 3"
              label={{
                value: 'Today',
                position: 'top',
                fontSize: 10,
                fill: 'var(--muted-foreground)',
              }}
            />
            <ReferenceLine x={`D${ovul}`} stroke="#f97316" strokeDasharray="2 3" strokeOpacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          <span className="text-[10px] text-muted-foreground">Estrogen</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-cyan-500" />
          <span className="text-[10px] text-muted-foreground">Progesterone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-400" />
          <span className="text-[10px] text-muted-foreground">Ovulation (~D{ovul})</span>
        </div>
        <span className="text-[10px] text-muted-foreground/80 ml-auto">
          Typical pattern for your cycle length — real readings need lab data
        </span>
      </div>
    </div>
  )
}

// ─── SVG Circular Progress ───────────────────────────────────────────────────

function CycleProgressRing({
  cycleDay,
  cycleLength,
  periodLength,
  phaseColor,
  phaseName,
  ofDaysLabel,
}: {
  cycleDay: number
  cycleLength: number
  periodLength: number
  phaseColor: string
  phaseName: string
  ofDaysLabel: string
}) {
  const radius = 90
  const strokeWidth = 10
  const normalizedRadius = radius - strokeWidth / 2
  const circumference = normalizedRadius * 2 * Math.PI
  const progress = cycleDay / cycleLength
  const strokeDashoffset = circumference - progress * circumference

  // Phase proportions
  const menstrualPct = periodLength / cycleLength
  const ovulationPct = 3 / cycleLength
  const follicularPct = (cycleLength - 14 - 1 - periodLength) / cycleLength
  const lutealPct = 1 - menstrualPct - ovulationPct - follicularPct

  return (
    <div className="relative flex items-center justify-center">
      <svg
        height={radius * 2}
        width={radius * 2}
        className="transform -rotate-90"
        role="img"
        aria-label={`Cycle day ${cycleDay} of ${cycleLength}`}
      >
        <circle
          stroke="oklch(0.91 0.02 325)"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Menstrual */}
        <circle
          stroke="#e11d48"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference * menstrualPct} ${circumference}`}
          strokeDashoffset={0}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          opacity={0.3}
          strokeLinecap="round"
        />
        {/* Follicular */}
        <circle
          stroke="#8b5cf6"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference * follicularPct} ${circumference}`}
          strokeDashoffset={-circumference * menstrualPct}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          opacity={0.3}
          strokeLinecap="round"
        />
        {/* Ovulation */}
        <circle
          stroke="#f97316"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference * ovulationPct} ${circumference}`}
          strokeDashoffset={-circumference * (menstrualPct + follicularPct)}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          opacity={0.3}
          strokeLinecap="round"
        />
        {/* Luteal */}
        <circle
          stroke="#06b6d4"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference * lutealPct} ${circumference}`}
          strokeDashoffset={-circumference * (menstrualPct + follicularPct + ovulationPct)}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          opacity={0.3}
          strokeLinecap="round"
        />
        {/* Active progress arc */}
        <circle
          stroke={phaseColor}
          fill="transparent"
          strokeWidth={strokeWidth + 2}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          style={{ transition: 'stroke-dashoffset 1.2s ease-in-out' }}
          className="drop-shadow-lg"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold gradient-text">{cycleDay}</span>
        <span className="text-xs text-muted-foreground mt-0.5">{ofDaysLabel}</span>
        <Badge
          className="mt-2 border-0 text-white font-semibold text-xs px-3 py-1"
          style={{ backgroundColor: phaseColor }}
        >
          {phaseName}
        </Badge>
      </div>
    </div>
  )
}
