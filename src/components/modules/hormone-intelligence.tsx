'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import {
  Brain,
  Droplets,
  Moon,
  Flame,
  TrendingUp,
  Activity,
  Sparkles,
  Heart,
  Sun,
  CloudRain,
  Battery,
  Coffee,
  Salad,
  Dumbbell,
  HandHeart,
  CheckCircle2,
  Flower2,
  ThermometerSun,
  Waves,
  Leaf,
  Plus,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

// ─── CONFIGURATION (kept — phase metadata & educational content) ────────────

const DEFAULT_CYCLE_LENGTH = 28

interface CycleDayData {
  day: number
  phase: string
  estrogen: number
  progesterone: number
  lh: number
  fsh: number
}

// Generates a TYPICAL (textbook) hormone curve for educational reference.
// This is not presented as the user's own data — only as an illustrative
// reference chart labeled "Typical hormone pattern".
function generateTypicalCycleData(cycleLength: number): CycleDayData[] {
  const data: CycleDayData[] = []
  const ovulationDay = cycleLength - 14
  const periodEnd = Math.min(5, Math.floor(cycleLength / 5))
  for (let d = 1; d <= cycleLength; d++) {
    let estrogen = 0
    let progesterone = 0
    let lh = 0
    let fsh = 0
    let phase = ''

    if (d <= periodEnd) {
      phase = 'Menstrual'
      estrogen = 25
      progesterone = 8
      lh = 6
      fsh = 10
    } else if (d < ovulationDay - 1) {
      phase = 'Follicular'
      const progress = (d - periodEnd) / (ovulationDay - 1 - periodEnd)
      estrogen = 30 + progress * 110
      progesterone = 8
      lh = 6
      fsh = 10 + progress * 4
    } else if (d >= ovulationDay - 1 && d <= ovulationDay + 1) {
      phase = 'Ovulation'
      estrogen = 145
      progesterone = 15
      lh = d === ovulationDay ? 90 : d === ovulationDay - 1 ? 50 : 30
      fsh = 14
    } else {
      phase = 'Luteal'
      const lutealProgress = (d - (ovulationDay + 1)) / (cycleLength - ovulationDay - 1)
      estrogen = 130 - lutealProgress * 80
      progesterone = 15 + lutealProgress * 95 - (lutealProgress > 0.6 ? lutealProgress * 50 : 0)
      lh = 6
      fsh = 6
    }

    data.push({
      day: d,
      phase,
      estrogen: Math.round(estrogen * 10) / 10,
      progesterone: Math.round(progesterone * 10) / 10,
      lh: Math.round(lh * 10) / 10,
      fsh: Math.round(fsh * 10) / 10,
    })
  }
  return data
}

const phaseGradients: Record<string, { from: string; to: string; accent: string; bg: string }> = {
  Menstrual: { from: '#6b21a8', to: '#be185d', accent: '#a855f7', bg: 'from-purple-900/80 to-rose-900/80' },
  Follicular: { from: '#7c3aed', to: '#ec4899', accent: '#c084fc', bg: 'from-violet-800/80 to-pink-700/80' },
  Ovulation: { from: '#8b5cf6', to: '#f43f5e', accent: '#f472b6', bg: 'from-purple-700/80 to-rose-600/80' },
  Luteal: { from: '#6d28d9', to: '#db2777', accent: '#d946ef', bg: 'from-violet-900/80 to-fuchsia-800/80' },
}

const phaseDescriptions: Record<string, { title: string; description: string; details: string }> = {
  Menstrual: {
    title: 'Menstrual Phase',
    description: 'Your body is shedding the uterine lining',
    details: 'Estrogen and progesterone are at their lowest. Your body is resetting for a new cycle. Energy may be lower — this is a time for rest and reflection.',
  },
  Follicular: {
    title: 'Follicular Phase',
    description: 'Estrogen is rising — energy and creativity surge',
    details: 'The pituitary releases FSH, stimulating follicle growth. Estrogen climbs steadily, boosting mood, energy, and cognitive function. This is your time to initiate and create.',
  },
  Ovulation: {
    title: 'Ovulation Phase',
    description: 'Peak estrogen & LH surge — you\'re at your most fertile',
    details: 'The LH surge triggers egg release. Estrogen peaks, making you feel confident, social, and vibrant. Your communication skills and energy are at their highest.',
  },
  Luteal: {
    title: 'Luteal Phase',
    description: 'Progesterone rises — your body prepares for potential pregnancy',
    details: 'Progesterone dominates, promoting calm and nesting behaviors. Estrogen has a secondary rise then falls. You may notice increased appetite, deeper intuition, and need for slower-paced activities.',
  },
}

// Educational phase-based insights. These are general guidance, not user data.
const phaseInsights: { id: string; icon: typeof Activity; title: string; content: string }[] = [
  {
    id: 'body',
    icon: Activity,
    title: "What's Happening in Your Body",
    content:
      'Hormones shift across four phases — menstrual, follicular, ovulation, and luteal. Tracking symptoms against your cycle phase helps you understand which phase affects you most.',
  },
  {
    id: 'activities',
    icon: Sparkles,
    title: 'Best Activities for This Phase',
    content:
      'Match your activity to your hormone profile. High-estrogen phases (follicular/ovulation) suit intense workouts and social events. Progesterone-dominant luteal phase suits slower, reflective activities.',
  },
  {
    id: 'nutrition',
    icon: Salad,
    title: 'Nutrition Recommendations',
    content:
      'Support each phase with phase-appropriate foods: iron-rich foods during menstruation, zinc-rich foods around ovulation, complex carbs and B-vitamins in the luteal phase.',
  },
  {
    id: 'exercise',
    icon: Dumbbell,
    title: 'Exercise Suggestions',
    content:
      'In the follicular/ovulation phase, push for HIIT and strength training. In the luteal phase, favor yoga, walking, and lighter strength work. During menstruation, listen to your body and rest as needed.',
  },
  {
    id: 'selfcare',
    icon: HandHeart,
    title: 'Self-Care Tips',
    content:
      'Use your cycle as a roadmap. Lean into social energy when estrogen peaks; protect rest and recovery when progesterone dominates. Journaling symptoms daily helps you spot patterns.',
  },
]

const symptomCategories = [
  { id: 'bloating', label: 'Bloating', icon: Droplets },
  { id: 'cramps', label: 'Cramps', icon: Waves },
  { id: 'headache', label: 'Headache', icon: Flame },
  { id: 'fatigue', label: 'Fatigue', icon: Battery },
  { id: 'mood-swings', label: 'Mood Swings', icon: CloudRain },
  { id: 'acne', label: 'Acne', icon: Sun },
  { id: 'cravings', label: 'Cravings', icon: Coffee },
  { id: 'insomnia', label: 'Insomnia', icon: Moon },
  { id: 'breast-tenderness', label: 'Breast Tenderness', icon: Heart },
  { id: 'anxiety', label: 'Anxiety', icon: Brain },
  { id: 'back-pain', label: 'Back Pain', icon: Activity },
  { id: 'hot-flashes', label: 'Hot Flashes', icon: ThermometerSun },
]

// ─── ANIMATION VARIANTS ──────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCta,
}: {
  icon: typeof Activity
  title: string
  description: string
  ctaLabel?: string
  onCta?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      {ctaLabel && onCta && (
        <button
          className="btn-plum mt-4 inline-flex items-center justify-center gap-2 rounded-full px-6 min-h-11 font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          onClick={onCta}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  )
}

// ─── CUSTOM TOOLTIP ───────────────────────────────────────────────────────────

function CustomChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border/50 bg-background/95 backdrop-blur-xl px-4 py-3 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1.5">Day {label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Cycle data type ────────────────────────────────────────────────────────

interface CycleEntry {
  id: string
  startDate: string
  endDate?: string | null
  cycleLength: number
  periodLength: number
  ovulationDate?: string | null
}

function deriveCycleDay(startISO: string, cycleLength: number): number | null {
  const start = new Date(startISO)
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (diff < 1) return null
  return ((diff - 1) % cycleLength) + 1
}

function getPhaseForCycleDay(day: number, cycleLength: number): string {
  const ovulationDay = cycleLength - 14
  const periodEnd = Math.min(5, Math.floor(cycleLength / 5))
  if (day <= periodEnd) return 'Menstrual'
  if (day < ovulationDay - 1) return 'Follicular'
  if (day >= ovulationDay - 1 && day <= ovulationDay + 1) return 'Ovulation'
  return 'Luteal'
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function HormoneModule() {
  const userProfile = useAppStore((s) => s.userProfile)
  const setActiveModule = useAppStore((s) => s.setActiveModule)

  const [cycles, setCycles] = useState<CycleEntry[]>([])
  const [loading, setLoading] = useState(true)

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

  const cycleLength = cycles[0]?.cycleLength ?? userProfile?.cycleLength ?? DEFAULT_CYCLE_LENGTH
  const latestStart = cycles[0]?.startDate ?? userProfile?.lastPeriodStart
  const cycleDay = latestStart ? deriveCycleDay(latestStart, cycleLength) : null
  const currentPhase = cycleDay ? getPhaseForCycleDay(cycleDay, cycleLength) : null
  const phaseInfo = currentPhase ? phaseDescriptions[currentPhase] : null
  const gradient = currentPhase ? phaseGradients[currentPhase] : phaseGradients.Follicular

  // Typical (educational) hormone curve — labeled as such, not the user's own readings
  const typicalCycleData = useMemo(() => generateTypicalCycleData(cycleLength), [cycleLength])

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-muted rounded-2xl" />
        <div className="h-80 bg-muted rounded-2xl" />
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Section 1: Phase Banner */}
      <motion.div variants={itemVariants}>
        <div className="card-plum relative p-6 sm:p-8">
          <div aria-hidden className="lotus-watermark absolute inset-0" />
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-plum-soft/40" />
          <div className="absolute -right-4 bottom-0 h-24 w-24 rounded-full bg-gold-soft/20" />
          <div className="absolute left-1/2 -bottom-6 h-32 w-32 rounded-full bg-plum-soft/30" />

          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Flower2 className="h-5 w-5 text-gold shrink-0" />
                  <span className="chip-soft px-2.5 py-1 text-xs font-medium text-plum">
                    {cycleDay ? `Cycle Day ${cycleDay} of ${cycleLength}` : 'No cycle logged yet'}
                  </span>
                </div>
                <h2 className="gold-shine font-serif text-2xl sm:text-3xl font-bold tracking-tight">
                  {phaseInfo ? phaseInfo.title : 'Welcome to Hormone Intelligence'}
                </h2>
                <p className="text-sm md:text-base max-w-xl opacity-90">
                  {phaseInfo
                    ? phaseInfo.description
                    : 'Log your period in the Cycle Tracker to see your current hormone phase, predictions, and personalized insights.'}
                </p>
                <span className="gold-divider text-[10px]" aria-hidden="true"><span>✦</span></span>
              </div>
              <div className="flex flex-col items-start md:items-end gap-2">
                {phaseInfo && (
                  <div className="text-right max-w-xs">
                    <p className="text-xs leading-relaxed opacity-90">{phaseInfo.details}</p>
                  </div>
                )}
                {!latestStart && (
                  <button
                    className="btn-plum inline-flex items-center gap-1.5 rounded-full px-6 min-h-11 font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    onClick={() => setActiveModule('period')}
                  >
                    <Plus className="h-4 w-4" />
                    Log your period
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Section 2: Hormone Trend Charts — educational typical curve */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-lg min-w-0">
                <TrendingUp className="h-5 w-5 text-primary shrink-0" />
                <span className="min-w-0">Typical Hormone Pattern — {cycleLength}-Day Cycle</span>
              </CardTitle>
              <Badge className="text-xs shrink-0">
                Educational
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="w-full h-[320px] md:h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={typicalCycleData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="estrogenGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="progesteroneGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="lhGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="fshGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickFormatter={(value: number) => `D${value}`}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  {cycleDay && (
                    <ReferenceLine
                      x={cycleDay}
                      stroke="#a855f7"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      label={{ value: 'Today', position: 'insideTopRight', fill: '#a855f7', fontSize: 12, fontWeight: 600, dy: -4 }}
                    />
                  )}
                  <Area type="monotone" dataKey="estrogen" name="Estrogen" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#estrogenGradient)" dot={false} />
                  <Area type="monotone" dataKey="progesterone" name="Progesterone" stroke="#ec4899" strokeWidth={2.5} fill="url(#progesteroneGradient)" dot={false} />
                  <Area type="monotone" dataKey="lh" name="LH" stroke="#f97316" strokeWidth={2} fill="url(#lhGradient)" dot={false} />
                  <Area type="monotone" dataKey="fsh" name="FSH" stroke="#14b8a6" strokeWidth={2} fill="url(#fshGradient)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center gap-2 sm:gap-3 mt-3 flex-wrap">
              {['Menstrual', 'Follicular', 'Ovulation', 'Luteal'].map((phase) => (
                <div key={phase} className="chip-soft flex items-center gap-1.5 px-2.5 py-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: phaseGradients[phase].accent }} />
                  <span className="text-xs text-foreground">{phase}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 text-center max-w-2xl mx-auto">
              This curve shows a typical textbook hormone pattern for a {cycleLength}-day cycle — it is not your personal data. Your real hormone readings will appear once you have lab results or BBT data logged.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 3: AI Predictions — empty state until user logs data */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg min-w-0">
              <Sparkles className="h-5 w-5 text-gold shrink-0" />
              AI Predictions — Next 7 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Sparkles}
              title="Personalized predictions coming soon"
              description="Log a couple of cycles, moods, and symptoms — Nuvia will then forecast your mood, energy, sleep, stress, productivity, and cravings for the coming week."
              ctaLabel="Start tracking"
              onCta={() => setActiveModule('period')}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 4: Phase-Based Insights (educational content) */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg min-w-0">
              <Leaf className="h-5 w-5 text-primary shrink-0" />
              <span className="min-w-0 truncate">Phase-Based Insights {currentPhase ? `— ${currentPhase} Phase` : ''}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {phaseInsights.map((insight, index) => (
                <AccordionItem key={insight.id} value={insight.id} className="border-border/50">
                  <AccordionTrigger className="hover:no-underline py-3 min-h-11">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, ${gradient.from}20, ${gradient.to}20)`,
                        }}
                      >
                        <insight.icon className="h-4 w-4" style={{ color: gradient.accent }} />
                      </div>
                      <span className="text-sm font-medium text-foreground min-w-0">{insight.title}</span>
                      {index === 0 && (
                        <span className="chip-soft px-2 py-0.5 text-[11px] font-semibold text-primary shrink-0">
                          Key
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-13 pr-2">
                      <p className="text-sm text-muted-foreground leading-relaxed">{insight.content}</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 5: Hormone Symptom Log — actually saves via API */}
      <HormoneLog userId={userProfile?.id} />
    </motion.div>
  )
}

// ─── SECTION: HORMONE LOG ────────────────────────────────────────────────────

function HormoneLog({ userId }: { userId: string | undefined }) {
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!userId) return
    setSaving(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      await Promise.all(
        selectedSymptoms.map((category) =>
          fetch('/api/symptoms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, category, severity: 3, date: today, notes: notes || undefined }),
          })
        )
      )
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setSelectedSymptoms([])
        setNotes('')
      }, 2500)
    } catch (e) {
      console.error('Failed to save hormone symptoms:', e)
      toast.error('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div variants={itemVariants}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg min-w-0">
            <Activity className="h-5 w-5 text-primary shrink-0" />
            Hormone Symptom Log
          </CardTitle>
          <p className="text-xs text-muted-foreground">Track symptoms that correlate with your hormonal changes</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Select symptoms you&apos;re experiencing</span>
            <div className="flex flex-wrap gap-2">
              {symptomCategories.map((symptom) => {
                const isSelected = selectedSymptoms.includes(symptom.id)
                return (
                  <motion.button
                    key={symptom.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleSymptom(symptom.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 border min-h-11 ${
                      isSelected
                        ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                        : 'chip-soft text-muted-foreground hover:text-primary'
                    }`}
                  >
                    <symptom.icon className="h-3 w-3" />
                    {symptom.label}
                    {isSelected && <CheckCircle2 className="h-3 w-3" />}
                  </motion.button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Additional notes</span>
            <textarea
              className="w-full rounded-xl border border-border/50 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring resize-none transition-all"
              rows={3}
              placeholder="Describe how you're feeling, any patterns you notice..."
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                setSaved(false)
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !userId || (selectedSymptoms.length === 0 && !notes)}
              className="btn-plum inline-flex items-center justify-center gap-1.5 rounded-full px-6 min-h-11 font-semibold text-sm transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              {saved ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Log Symptoms
                </>
              )}
            </button>
            {saved && (
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xs text-emerald-600 dark:text-emerald-400"
              >
                Symptoms logged successfully — AI will correlate with your hormone data
              </motion.p>
            )}
            {selectedSymptoms.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedSymptoms.length} symptom{selectedSymptoms.length !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
