'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
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
} from 'lucide-react'

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
  { name: 'Menstrual', days: '1-5', color: '#e11d48' },
  { name: 'Follicular', days: '6-13', color: '#8b5cf6' },
  { name: 'Ovulation', days: '14-16', color: '#f97316' },
  { name: 'Luteal', days: '17-28', color: '#06b6d4' },
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
    if (hour < 12) return 'Good Morning'
    if (hour < 17) return 'Good Afternoon'
    return 'Good Evening'
  }, [])

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }, [])

  const greetingIcon = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return Sun
    if (hour < 17) return CloudSun
    return Moon
  }, [])

  const GreetingIcon = greetingIcon

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
      label: 'Log Period',
      color: 'bg-rose-500 hover:bg-rose-600',
      textColor: 'text-white',
      module: 'period' as const,
    },
    {
      icon: Sparkles,
      label: 'Log Mood',
      color: 'bg-purple-500 hover:bg-purple-600',
      textColor: 'text-white',
      module: 'mental' as const,
    },
    {
      icon: HeartPulse,
      label: 'Log Symptoms',
      color: 'bg-pink-500 hover:bg-pink-600',
      textColor: 'text-white',
      module: 'symptoms' as const,
    },
    {
      icon: GlassWater,
      label: 'Log Water',
      color: 'bg-sky-500 hover:bg-sky-600',
      textColor: 'text-white',
      module: 'fitness' as const,
    },
    {
      icon: Moon,
      label: 'Log Sleep',
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
              Day {cycleInfo.cycleDay} of Cycle
            </Badge>
            <Badge
              className="gap-1.5 px-3 py-1 text-xs font-semibold text-white border-0"
              style={{ backgroundColor: cycleInfo.phase.color }}
            >
              <Sparkles className="h-3 w-3" />
              {cycleInfo.phase.name} Phase
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
                    phaseName={cycleInfo.phase.name}
                  />
                </div>

                {/* Phase Info */}
                <div className="flex-1 text-center lg:text-left space-y-4 w-full">
                  <div>
                    <h2 className="text-xl font-bold mb-1">
                      You&apos;re in your{' '}
                      <span style={{ color: cycleInfo.phase.color }} className="font-extrabold">
                        {cycleInfo.phase.name}
                      </span>{' '}
                      phase
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      Log symptoms, mood, and sleep to learn how this phase affects you.
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                    <div className="text-center px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/30">
                      <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                        {cycleInfo.daysUntilPeriod}
                      </p>
                      <p className="text-xs text-muted-foreground">Days until period</p>
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
                      <p className="text-xs text-muted-foreground">Days to ovulation</p>
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
                          {phase.name} <span className="font-medium text-foreground">({phase.days})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Droplets}
                title="No cycle logged yet"
                description="Log your first period start date to unlock cycle predictions, fertility windows, and phase insights."
                ctaLabel="Log your first period"
                onCta={() => setActiveModule('period')}
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── 3. Quick Stats Row ─────────────────────────────────────────────── */}
      {cycleInfo && (
        <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: 'Cycle Day',
              value: cycleInfo.cycleDay,
              subtitle: `of ${cycleInfo.cycleLength} days`,
              icon: CalendarDays,
              color: 'text-rose-500',
              bg: 'bg-rose-50 dark:bg-rose-950/30',
              badge: { text: cycleInfo.phase.name, bg: cycleInfo.phase.color },
            },
            {
              title: 'Days Until Period',
              value: cycleInfo.daysUntilPeriod,
              subtitle: 'countdown',
              icon: Clock,
              color: 'text-purple-500',
              bg: 'bg-purple-50 dark:bg-purple-950/30',
              badge: null,
            },
            {
              title: 'Fertility Status',
              value: cycleInfo.phase.name === 'Ovulation' ? 'Peak' : '—',
              subtitle:
                cycleInfo.phase.name === 'Ovulation'
                  ? 'High chance'
                  : 'Log to learn more',
              icon: Baby,
              color: 'text-orange-500',
              bg: 'bg-orange-50 dark:bg-orange-950/30',
              badge:
                cycleInfo.phase.name === 'Ovulation'
                  ? { text: 'Peak', bg: '#e11d48' }
                  : null,
            },
            {
              title: 'Next Ovulation',
              value: '—',
              subtitle: 'Based on cycle length',
              icon: Flower2,
              color: 'text-emerald-500',
              bg: 'bg-emerald-50 dark:bg-emerald-950/30',
              badge: null,
            },
          ].map((stat) => (
            <Card
              key={stat.title}
              className="glass border-0 shadow-md hover:shadow-lg transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
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
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.subtitle}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* ─── 4. Hormone Preview — empty until user logs data ────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass border-0 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-rose-500" />
              <CardTitle className="text-base">Hormone Preview</CardTitle>
            </div>
            <CardDescription>
              Your hormone patterns will appear here once you have cycle data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Activity}
              title="No hormone insights yet"
              description="Log a couple of cycles and ChandraCycle will visualize your estrogen and progesterone patterns across your cycle."
              ctaLabel="Log your period"
              onCta={() => setActiveModule('period')}
            />
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
            <EmptyState
              icon={Sparkles}
              title="Personalized insights coming soon"
              description="Once you start logging your cycle, mood, and symptoms, ChandraCycle's AI will surface personalized recommendations for your current phase."
              ctaLabel="Start tracking"
              onCta={() => setActiveModule('period')}
            />
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
                  key={btn.label}
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
                  aria-label={btn.label}
                  onClick={() => setActiveModule(btn.module)}
                >
                  <btn.icon className="h-6 w-6" />
                  <span className="text-xs font-semibold">{btn.label}</span>
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
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
                description="You haven't set any reminders yet. Add reminders for medications, hydration, or checkups in Settings."
                ctaLabel="Go to Settings"
                onCta={() => setActiveModule('settings')}
              />
            ) : (
              <div className="space-y-2">
                {reminders.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-xl border bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2.5 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">Dr. {r.doctorName} — {r.specialty}</p>
                      <p className="text-xs text-muted-foreground">{r.type} appointment</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">{r.date}</p>
                      <p className="text-[10px] text-muted-foreground">{r.time}</p>
                    </div>
                  </div>
                ))}
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

// ─── SVG Circular Progress ───────────────────────────────────────────────────

function CycleProgressRing({
  cycleDay,
  cycleLength,
  periodLength,
  phaseColor,
  phaseName,
}: {
  cycleDay: number
  cycleLength: number
  periodLength: number
  phaseColor: string
  phaseName: string
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
        <span className="text-xs text-muted-foreground mt-0.5">of {cycleLength} days</span>
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
