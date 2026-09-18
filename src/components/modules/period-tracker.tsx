'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  addDays,
  differenceInDays,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  subMonths,
  addMonths,
} from 'date-fns'
import {
  Droplets,
  Heart,
  Brain,
  Sparkles,
  CalendarDays,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Activity,
  Moon,
  Sun,
  Thermometer,
  Zap,
  CircleDot,
  Clock,
  FileText,
  Plus,
  Check,
  CalendarPlus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

// ─── Configuration (kept — these are phase metadata, not user data) ─────────

interface CyclePhase {
  name: string
  startDay: number
  endDay: number
  color: string
  bgColor: string
  lightColor: string
  description: string
  hormones: { estrogen: number; progesterone: number; lh: number; fsh: number }
  icon: React.ReactNode
}

const PHASES: CyclePhase[] = [
  {
    name: 'Menstrual',
    startDay: 1,
    endDay: 5,
    color: 'oklch(0.62 0.22 355)',
    bgColor: 'oklch(0.62 0.22 355 / 0.12)',
    lightColor: 'oklch(0.9 0.06 355)',
    description: 'Uterine lining sheds. Estrogen and progesterone are at their lowest.',
    hormones: { estrogen: 15, progesterone: 5, lh: 10, fsh: 20 },
    icon: <Droplets className="h-4 w-4" />,
  },
  {
    name: 'Follicular',
    startDay: 6,
    endDay: 12,
    color: 'oklch(0.62 0.19 305)',
    bgColor: 'oklch(0.62 0.19 305 / 0.12)',
    lightColor: 'oklch(0.9 0.06 305)',
    description: 'Estrogen rises as follicles develop. Energy and mood improve.',
    hormones: { estrogen: 65, progesterone: 15, lh: 20, fsh: 50 },
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    name: 'Ovulation',
    startDay: 13,
    endDay: 15,
    color: 'oklch(0.72 0.15 55)',
    bgColor: 'oklch(0.72 0.15 55 / 0.14)',
    lightColor: 'oklch(0.9 0.06 55)',
    description: 'LH surges, egg is released. Peak fertility window.',
    hormones: { estrogen: 90, progesterone: 25, lh: 95, fsh: 40 },
    icon: <Sun className="h-4 w-4" />,
  },
  {
    name: 'Luteal',
    startDay: 16,
    endDay: 28,
    color: 'oklch(0.68 0.12 200)',
    bgColor: 'oklch(0.68 0.12 200 / 0.12)',
    lightColor: 'oklch(0.9 0.06 200)',
    description: 'Progesterone peaks. PMS symptoms may appear.',
    hormones: { estrogen: 45, progesterone: 80, lh: 10, fsh: 10 },
    icon: <Moon className="h-4 w-4" />,
  },
]

interface SymptomItem {
  id: string
  label: string
  icon: React.ReactNode
}

const SYMPTOMS: SymptomItem[] = [
  { id: 'cramps', label: 'Cramps', icon: <Zap className="h-4 w-4" /> },
  { id: 'headache', label: 'Headache', icon: <Brain className="h-4 w-4" /> },
  { id: 'bloating', label: 'Bloating', icon: <Droplets className="h-4 w-4" /> },
  { id: 'acne', label: 'Acne', icon: <CircleDot className="h-4 w-4" /> },
  { id: 'fatigue', label: 'Fatigue', icon: <Moon className="h-4 w-4" /> },
  { id: 'backache', label: 'Backache', icon: <Activity className="h-4 w-4" /> },
  { id: 'nausea', label: 'Nausea', icon: <Thermometer className="h-4 w-4" /> },
  { id: 'breast_tenderness', label: 'Breast Tenderness', icon: <Heart className="h-4 w-4" /> },
]

// ─── Helper Functions ─────────────────────────────────────────────────

function getPhaseForCycleDay(day: number, cycleLength: number): CyclePhase {
  // Map cycle day to phase based on cycle length
  const ovulationDay = cycleLength - 14
  const periodEnd = Math.min(5, cycleLength / 4)
  if (day <= periodEnd) return PHASES[0]
  if (day < ovulationDay - 1) return PHASES[1]
  if (day >= ovulationDay - 1 && day <= ovulationDay + 1) return PHASES[2]
  return PHASES[3]
}

// ─── Cycle data type ──────────────────────────────────────────────────

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

// ─── Sub-Components ───────────────────────────────────────────────────

function CycleWheel({
  cycleDay,
  cycleLength,
}: {
  cycleDay: number
  cycleLength: number
}) {
  const currentPhase = getPhaseForCycleDay(cycleDay, cycleLength)

  const wheelData = PHASES.map((phase) => ({
    name: phase.name,
    value: phase.endDay - phase.startDay + 1,
    color: phase.color,
    lightColor: phase.lightColor,
  }))

  const totalAngle = 360
  const anglePerDay = totalAngle / cycleLength
  const currentAngle = (cycleDay - 0.5) * anglePerDay

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="flex flex-col items-center"
    >
      <div className="relative w-[min(80vw,320px)] h-[min(80vw,320px)] sm:w-[380px] sm:h-[380px]">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="200" cy="200" r="195" fill="none" stroke="rgba(244,114,182,0.1)" strokeWidth="1" />
          <circle
            cx="200"
            cy="200"
            r="170"
            fill="none"
            stroke={currentPhase.color}
            strokeWidth="4"
            strokeDasharray="8 345"
            strokeDashoffset={-(currentAngle / 360) * 2 * Math.PI * 170 + 2}
            strokeLinecap="round"
            filter="url(#glow)"
            opacity="0.8"
          />
        </svg>

        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={wheelData}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="78%"
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
                cornerRadius={8}
                paddingAngle={3}
              >
                {wheelData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    opacity={PHASES[index].name === currentPhase.name ? 1 : 0.55}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    const phase = PHASES.find((p) => p.name === data.name)
                    return (
                      <div className="rounded-xl bg-card/95 backdrop-blur-md border border-border/60 px-3 py-2 shadow-lg">
                        <p className="font-semibold text-sm" style={{ color: phase?.color }}>{data.name}</p>
                        <p className="text-xs text-muted-foreground">Days {phase?.startDay}–{phase?.endDay}</p>
                      </div>
                    )
                  }
                  return null
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-center"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Cycle Day
            </p>
            <motion.p
              key={cycleDay}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
              className="font-serif text-5xl sm:text-6xl font-bold text-foreground"
            >
              {cycleDay}
            </motion.p>
            <Badge
              className="mt-3 px-3.5 py-1.5 text-xs font-semibold border-0 shadow-sm"
              style={{ backgroundColor: currentPhase.bgColor, color: currentPhase.color }}
            >
              {currentPhase.icon}
              <span className="ml-1">{currentPhase.name} Phase</span>
            </Badge>
          </motion.div>
        </div>

        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 400">
          <circle
            cx={200 + 155 * Math.cos(((currentAngle - 90) * Math.PI) / 180)}
            cy={200 + 155 * Math.sin(((currentAngle - 90) * Math.PI) / 180)}
            r="8"
            fill="white"
            stroke={currentPhase.color}
            strokeWidth="3"
            filter="url(#glow)"
          />
        </svg>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mt-4">
        {PHASES.map((phase) => (
          <motion.div
            key={phase.name}
            whileHover={{ scale: 1.04 }}
            className={`chip-soft flex items-center gap-2 px-3 py-1.5 text-xs font-medium ${
              phase.name === currentPhase.name ? 'opacity-100 shadow-sm' : 'opacity-70'
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: phase.color }} />
            <span className="text-foreground">{phase.name}</span>
            <span className="text-muted-foreground">D{phase.startDay}–D{phase.endDay}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Calendar View ────────────────────────────────────────────────────

function CycleCalendar({
  cycleStart,
  cycleLength,
  periodLength,
}: {
  cycleStart: Date
  cycleLength: number
  periodLength: number
}) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const days: Date[] = []
  let day = calStart
  while (day <= calEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  function isPeriodDay(date: Date): boolean {
    const dayDiff = differenceInDays(date, cycleStart) + 1
    const cycleDay = ((dayDiff - 1) % cycleLength) + 1
    return dayDiff >= 1 && cycleDay >= 1 && cycleDay <= periodLength
  }

  function isOvulationDay(date: Date): boolean {
    const dayDiff = differenceInDays(date, cycleStart) + 1
    const cycleDay = ((dayDiff - 1) % cycleLength) + 1
    return dayDiff >= 1 && cycleDay === cycleLength - 14
  }

  function isFertileWindow(date: Date): boolean {
    const dayDiff = differenceInDays(date, cycleStart) + 1
    const cycleDay = ((dayDiff - 1) % cycleLength) + 1
    return dayDiff >= 1 && cycleDay >= cycleLength - 18 && cycleDay <= cycleLength - 12
  }

  function isPredictedPeriod(date: Date): boolean {
    const nextPeriodStart = addDays(cycleStart, cycleLength)
    const dayDiff = differenceInDays(date, nextPeriodStart)
    return dayDiff >= 0 && dayDiff < periodLength
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth((p) => subMonths(p, 1))} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth((p) => addMonths(p, 1))} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((wd) => (
          <div key={wd} className="text-center text-xs font-medium text-muted-foreground py-1">
            {wd}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const inMonth = isSameMonth(d, currentMonth)
          const periodDay = isPeriodDay(d)
          const ovDay = isOvulationDay(d)
          const fertile = isFertileWindow(d)
          const predicted = isPredictedPeriod(d)
          const isToday = isSameDay(d, new Date())

          let bgClass = ''
          let borderClass = 'border border-transparent'
          let textClass = ''
          let dotColor = ''
          let label = ''

          if (!inMonth) {
            textClass = 'text-muted-foreground opacity-30'
          } else if (periodDay) {
            bgClass = 'bg-rose-500/15'
            textClass = 'text-rose-700 dark:text-rose-300 font-semibold'
            dotColor = 'oklch(0.62 0.22 355)'
            label = '🩸'
          } else if (ovDay) {
            bgClass = 'bg-amber-400/20'
            textClass = 'text-amber-700 dark:text-amber-300 font-semibold'
            dotColor = 'oklch(0.72 0.15 55)'
            label = '🥚'
          } else if (fertile) {
            bgClass = 'bg-violet-400/15'
            textClass = 'text-violet-700 dark:text-violet-300'
            dotColor = 'oklch(0.62 0.19 305)'
          } else if (predicted) {
            bgClass = 'bg-rose-400/5'
            textClass = 'text-rose-500 dark:text-rose-400'
            dotColor = 'oklch(0.7 0.18 350)'
            borderClass = 'border border-dashed border-rose-400/60 dark:border-rose-400/40'
            label = '✦'
          }

          return (
            <motion.div
              key={i}
              whileHover={{ scale: 1.08 }}
              className={`relative flex flex-col items-center justify-center h-9 sm:h-10 rounded-xl text-xs transition-all duration-200 cursor-default ${borderClass} ${bgClass} ${textClass} ${
                isToday ? 'ring-2 ring-rose-500 ring-offset-2 ring-offset-background' : ''
              }`}
            >
              <span>{format(d, 'd')}</span>
              {dotColor && (
                <div className="absolute bottom-0.5 w-1 h-1 rounded-full" style={{ backgroundColor: dotColor }} />
              )}
              {label && (
                <span className="absolute -top-0.5 -right-0.5 text-[8px] leading-none">{label}</span>
              )}
            </motion.div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2 mt-4 text-xs">
        <span className="chip-soft inline-flex items-center gap-1.5 px-2.5 py-1">
          <span className="w-2.5 h-2.5 rounded bg-rose-500/20 border border-rose-500/50" />
          <span className="text-muted-foreground">Period</span>
        </span>
        <span className="chip-soft inline-flex items-center gap-1.5 px-2.5 py-1">
          <span className="w-2.5 h-2.5 rounded bg-amber-400/25 border border-amber-500/50" />
          <span className="text-muted-foreground">Ovulation</span>
        </span>
        <span className="chip-soft inline-flex items-center gap-1.5 px-2.5 py-1">
          <span className="w-2.5 h-2.5 rounded bg-violet-400/20 border border-violet-500/50" />
          <span className="text-muted-foreground">Fertile Window</span>
        </span>
        <span className="chip-soft inline-flex items-center gap-1.5 px-2.5 py-1">
          <span className="w-2.5 h-2.5 rounded border border-dashed border-rose-400/70" />
          <span className="text-muted-foreground">Predicted Period</span>
        </span>
      </div>
    </motion.div>
  )
}

// ─── Cycle Timeline ───────────────────────────────────────────────────

function CycleTimeline({ cycleDay, cycleLength }: { cycleDay: number; cycleLength: number }) {
  const currentPhase = getPhaseForCycleDay(cycleDay, cycleLength)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="space-y-4"
    >
      <div className="relative">
        <div className="flex h-3 rounded-full overflow-hidden">
          {PHASES.map((phase) => {
            const widthPct = ((phase.endDay - phase.startDay + 1) / cycleLength) * 100
            const isActive = phase.name === currentPhase.name
            return (
              <motion.div
                key={phase.name}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: phase.color,
                  opacity: isActive ? 1 : 0.4,
                  transformOrigin: 'left',
                }}
                className="h-full first:rounded-l-full last:rounded-r-full relative"
              />
            )
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          className="absolute top-1/2 -translate-y-1/2"
          style={{ left: `${((cycleDay - 0.5) / cycleLength) * 100}%` }}
        >
          <div className="w-5 h-5 rounded-full bg-white border-2 shadow-md -translate-x-1/2" style={{ borderColor: currentPhase.color }}>
            <div
              className="w-2 h-2 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ backgroundColor: currentPhase.color }}
            />
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PHASES.map((phase) => {
          const isActive = phase.name === currentPhase.name
          return (
            <motion.div
              key={phase.name}
              whileHover={{ y: -2 }}
              className={`relative rounded-xl p-3 border transition-all ${
                isActive ? 'shadow-lg' : 'opacity-60 hover:opacity-80'
              }`}
              style={{
                backgroundColor: phase.bgColor,
                borderColor: isActive ? phase.color : 'transparent',
              }}
            >
              {isActive && (
                <Badge
                  className="absolute -top-2 right-2 text-[10px] px-2 border-0"
                  style={{ backgroundColor: phase.color, color: 'white' }}
                >
                  Current
                </Badge>
              )}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: phase.color, color: 'white' }}>
                  {phase.icon}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: phase.color }}>
                    {phase.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Days {phase.startDay}–{phase.endDay}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{phase.description}</p>
              <div className="space-y-1.5">
                <HormoneBar label="Estrogen" value={phase.hormones.estrogen} color="#ec4899" />
                <HormoneBar label="Progesterone" value={phase.hormones.progesterone} color="#a855f7" />
                <HormoneBar label="LH" value={phase.hormones.lh} color="#f97316" />
                <HormoneBar label="FSH" value={phase.hormones.fsh} color="#06b6d4" />
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

function HormoneBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] w-20 text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] w-6 text-right text-muted-foreground">{value}</span>
    </div>
  )
}

// ─── Log Period ───────────────────────────────────────────────────────

function LogPeriodSection({
  userId,
  onLogged,
  defaultCycleLength,
  defaultPeriodLength,
}: {
  userId: string | undefined
  onLogged: () => void
  defaultCycleLength: number
  defaultPeriodLength: number
}) {
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const [flowIntensity, setFlowIntensity] = useState<string>('medium')
  const [startDate, setStartDate] = useState(todayIso)
  const [duration, setDuration] = useState(String(defaultPeriodLength))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [logged, setLogged] = useState(false)

  const flowOptions = [
    { value: 'light', label: 'Light', icon: <Droplets className="h-3 w-3" />, color: '#f9a8d4' },
    { value: 'medium', label: 'Medium', icon: <Droplets className="h-4 w-4" />, color: '#ec4899' },
    { value: 'heavy', label: 'Heavy', icon: <Droplets className="h-5 w-5" />, color: '#be185d' },
  ]

  const handleLog = async () => {
    if (!userId) return
    setSaving(true)
    try {
      const periodLen = Number(duration) || defaultPeriodLength
      const endDate = format(addDays(new Date(startDate), periodLen - 1), 'yyyy-MM-dd')
      await fetch('/api/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          startDate,
          endDate,
          cycleLength: defaultCycleLength,
          periodLength: periodLen,
          notes: notes ? `${flowIntensity} flow. ${notes}` : `${flowIntensity} flow.`,
        }),
      })
      setLogged(true)
      setTimeout(() => {
        setLogged(false)
        onLogged()
      }, 1500)
    } catch (e) {
      console.error('Failed to log cycle:', e)
      toast.error('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleQuickLogToday = async () => {
    if (!userId) return
    setSaving(true)
    try {
      await fetch('/api/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          startDate: todayIso,
          cycleLength: defaultCycleLength,
          periodLength: defaultPeriodLength,
          notes: `${flowIntensity} flow. Started today.`,
        }),
      })
      onLogged()
    } finally {
      setSaving(false)
    }
  }

  const handleLogSpotting = async () => {
    if (!userId) return
    setSaving(true)
    try {
      const res = await fetch('/api/symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          category: 'spotting',
          severity: 1,
          date: todayIso,
          notes: 'Spotting logged',
        }),
      })
      if (res.ok) {
        toast.success('Spotting logged for today')
        onLogged()
      } else {
        toast.error('Could not log spotting. Please try again.')
      }
    } catch {
      toast.error('Could not log spotting. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="space-y-5"
    >
      <div>
        <Label className="text-xs font-medium text-muted-foreground mb-2 block">Quick Log</Label>
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Start Period Today
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-rose-600">Log Period Start</DialogTitle>
                <DialogDescription>
                  Record that your period started today ({format(new Date(), 'MMM d, yyyy')}).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">
                  This will update your cycle tracking and predictions. Your cycle day will reset to Day 1.
                </p>
                <Button
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white"
                  onClick={handleQuickLogToday}
                  disabled={saving || !userId}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Confirm Period Started
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogSpotting}
            disabled={saving || !userId}
            className="gap-1.5 border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
          >
            <CircleDot className="h-3.5 w-3.5" />
            Log Spotting
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Duration (days)</Label>
            <Input
              type="number"
              min="1"
              max="14"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Flow Intensity</Label>
          <div className="flex gap-2">
            {flowOptions.map((opt) => (
              <motion.button
                key={opt.value}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFlowIntensity(opt.value)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                  flowIntensity === opt.value
                    ? 'shadow-md'
                    : 'border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                }`}
                style={{
                  borderColor: flowIntensity === opt.value ? opt.color : undefined,
                  backgroundColor: flowIntensity === opt.value ? `${opt.color}20` : undefined,
                }}
              >
                <span style={{ color: opt.color }}>{opt.icon}</span>
                <span className="text-xs font-medium">{opt.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes about your period..."
            className="min-h-[60px] text-sm resize-none"
          />
        </div>

        <Button
          onClick={handleLog}
          className="w-full bg-rose-500 hover:bg-rose-600 text-white"
          disabled={saving || !userId}
        >
          {logged ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Logged Successfully!
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Log Period
            </>
          )}
        </Button>
      </div>
    </motion.div>
  )
}

// ─── Symptom Quick Log ────────────────────────────────────────────────

function SymptomQuickLog({ userId }: { userId: string | undefined }) {
  const [selectedSymptoms, setSelectedSymptoms] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms((prev) => {
      const next = { ...prev }
      if (next[id]) {
        delete next[id]
      } else {
        next[id] = 3
      }
      return next
    })
  }

  const setSeverity = (id: string, level: number) => {
    setSelectedSymptoms((prev) => ({ ...prev, [id]: level }))
  }

  const handleSave = async () => {
    if (!userId) return
    setSaving(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      await Promise.all(
        Object.entries(selectedSymptoms).map(([category, severity]) =>
          fetch('/api/symptoms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, category, severity, date: today }),
          })
        )
      )
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setSelectedSymptoms({})
      }, 1500)
    } catch (e) {
      console.error('Failed to save symptoms:', e)
      toast.error('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SYMPTOMS.map((symptom) => {
          const isSelected = symptom.id in selectedSymptoms
          const severity = selectedSymptoms[symptom.id] || 0
          return (
            <motion.div key={symptom.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <button
                onClick={() => toggleSymptom(symptom.id)}
                className={`w-full flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                  isSelected
                    ? 'border-rose-400 bg-rose-50/80 dark:bg-rose-950/30 shadow-sm'
                    : 'border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                <span className={isSelected ? 'text-rose-500' : 'text-muted-foreground'}>{symptom.icon}</span>
                <span
                  className={`text-xs font-medium ${
                    isSelected ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground'
                  }`}
                >
                  {symptom.label}
                </span>
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="w-full"
                  >
                    <div className="flex justify-center gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <button
                          key={level}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSeverity(symptom.id, level)
                          }}
                          className={`w-4 h-4 rounded-full border-2 transition-all ${
                            level <= severity ? 'border-rose-400 bg-rose-400' : 'border-gray-300 dark:border-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {severity <= 1 ? 'Mild' : severity <= 3 ? 'Moderate' : 'Severe'}
                    </p>
                  </motion.div>
                )}
              </button>
            </motion.div>
          )
        })}
      </div>

      {Object.keys(selectedSymptoms).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200"
        >
          <p className="text-xs text-rose-700 dark:text-rose-300">
            {Object.keys(selectedSymptoms).length} symptom{Object.keys(selectedSymptoms).length > 1 ? 's' : ''} selected
          </p>
          <Button
            size="sm"
            className="h-7 bg-rose-500 hover:bg-rose-600 text-white text-xs"
            onClick={handleSave}
            disabled={saving || !userId}
          >
            <Check className="h-3 w-3 mr-1" />
            {saved ? 'Saved!' : 'Save Symptoms'}
          </Button>
        </motion.div>
      )}
    </motion.div>
  )
}

// ─── Period Predictions ───────────────────────────────────────────────

function PeriodPredictions({
  cycleStart,
  cycleLength,
  periodLength,
  historyCount,
}: {
  cycleStart: Date
  cycleLength: number
  periodLength: number
  historyCount: number
}) {
  const [exportingIcs, setExportingIcs] = useState(false)
  const nextPeriodStart = addDays(cycleStart, cycleLength)
  const daysUntilNext = differenceInDays(nextPeriodStart, new Date())
  // Confidence grows with history but caps at 90% — purely a heuristic, not a fake number.
  const confidence = Math.min(90, Math.round(50 + historyCount * 8))

  // ─── Export the next 6 predicted cycles as an .ics calendar file ────────
  // All-day events: period days (DTEND exclusive), fertile window, ovulation.
  const handleExportIcs = () => {
    setExportingIcs(true)
    try {
      const pad = (n: number) => String(n).padStart(2, '0')
      const toIcsDate = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
      const stamp = toIcsDate(new Date())
      const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')

      const events: string[] = []
      for (let i = 1; i <= 6; i++) {
        const pStart = addDays(cycleStart, i * cycleLength)
        const pEndExclusive = addDays(pStart, periodLength)
        const ovulation = addDays(pStart, -14)
        const fertileStart = addDays(ovulation, -4)
        const fertileEndExclusive = addDays(ovulation, 2)
        const cycleNum = i + 1

        events.push(
          'BEGIN:VEVENT',
          `UID:period-${cycleNum}-${toIcsDate(pStart)}@chandracycle.app`,
          `DTSTAMP;VALUE=DATE:${stamp}`,
          `DTSTART;VALUE=DATE:${toIcsDate(pStart)}`,
          `DTEND;VALUE=DATE:${toIcsDate(pEndExclusive)}`,
          `SUMMARY:${escape(`🌸 Predicted period · Cycle ${cycleNum}`)}`,
          `DESCRIPTION:${escape(`Predicted from ${historyCount} logged cycle(s) with a ${cycleLength}-day average. Nuvia estimate — not medical advice.`)}`,
          'CATEGORIES:HEALTH',
          'END:VEVENT',
          'BEGIN:VEVENT',
          `UID:fertile-${cycleNum}-${toIcsDate(pStart)}@chandracycle.app`,
          `DTSTAMP;VALUE=DATE:${stamp}`,
          `DTSTART;VALUE=DATE:${toIcsDate(fertileStart)}`,
          `DTEND;VALUE=DATE:${toIcsDate(fertileEndExclusive)}`,
          `SUMMARY:${escape(`🌙 Fertile window · Cycle ${cycleNum}`)}`,
          `DESCRIPTION:${escape(`Estimated fertile window ending with ovulation on ${format(ovulation, 'MMM d')}.`)}`,
          'CATEGORIES:HEALTH',
          'END:VEVENT',
          'BEGIN:VEVENT',
          `UID:ovulation-${cycleNum}-${toIcsDate(pStart)}@chandracycle.app`,
          `DTSTAMP;VALUE=DATE:${stamp}`,
          `DTSTART;VALUE=DATE:${toIcsDate(ovulation)}`,
          `DTEND;VALUE=DATE:${toIcsDate(addDays(ovulation, 1))}`,
          `SUMMARY:${escape(`🥚 Estimated ovulation · Cycle ${cycleNum}`)}`,
          'CATEGORIES:HEALTH',
          'END:VEVENT'
        )
      }

      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Nuvia//Period Predictions//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Nuvia Period Predictions',
        'X-WR-CALDESC:Predicted periods\\, fertile windows and ovulation days',
        ...events,
        'END:VCALENDAR',
      ].join('\r\n')

      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chandracycle-predictions-${format(new Date(), 'yyyy-MM-dd')}.ics`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Calendar file downloaded — import it into Google Calendar, Apple Calendar or Outlook 📅')
    } catch {
      toast.error('Could not generate the calendar file')
    } finally {
      setExportingIcs(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="space-y-4"
    >
      <div className="text-center p-5 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border border-rose-100 dark:border-rose-900/40">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Next Period In</p>
        <motion.p
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
          className="font-serif text-5xl font-bold text-rose-600 dark:text-rose-300"
        >
          {Math.max(0, daysUntilNext)}
        </motion.p>
        <p className="text-sm text-muted-foreground">days</p>
        <p className="text-xs text-rose-500 dark:text-rose-400 font-medium mt-1">{format(nextPeriodStart, 'EEEE, MMMM d')}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-3 rounded-2xl bg-blush">
          <CalendarDays className="h-4 w-4 mx-auto mb-1 text-rose-500" />
          <p className="text-lg font-bold text-rose-600 dark:text-rose-300">{cycleLength}</p>
          <p className="text-[10px] text-muted-foreground">Cycle Length</p>
        </div>
        <div className="text-center p-3 rounded-2xl bg-peach-soft">
          <Droplets className="h-4 w-4 mx-auto mb-1 text-amber-500" />
          <p className="text-lg font-bold text-amber-600 dark:text-amber-300">{periodLength}</p>
          <p className="text-[10px] text-muted-foreground">Period Length</p>
        </div>
        <div className="text-center p-3 rounded-2xl bg-medical-soft">
          <TrendingUp className="h-4 w-4 mx-auto mb-1 text-teal-600 dark:text-teal-300" />
          <p className="text-lg font-bold text-teal-700 dark:text-teal-300">{confidence}%</p>
          <p className="text-[10px] text-muted-foreground">Confidence</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Prediction Confidence</span>
          <span className="text-xs font-medium text-emerald-600">{confidence}%</span>
        </div>
        <Progress value={confidence} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-rose-400 [&>div]:to-emerald-400" />
        <p className="text-[10px] text-muted-foreground">Based on {historyCount} tracked cycle{historyCount === 1 ? '' : 's'}</p>
      </div>

      <Button
        variant="outline"
        disabled={exportingIcs}
        onClick={handleExportIcs}
        className="w-full h-9 text-xs border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 dark:hover:border-rose-800 transition-all group"
      >
        {exportingIcs ? (
          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
        ) : (
          <CalendarPlus className="h-3.5 w-3.5 mr-2 transition-transform group-hover:-rotate-12" />
        )}
        Sync 6 cycles to my calendar (.ics)
      </Button>
    </motion.div>
  )
}

// ─── Historical Cycles Table ──────────────────────────────────────────

function HistoricalCyclesTable({
  cycles,
  onChanged,
}: {
  cycles: CycleEntry[]
  onChanged?: () => void
}) {
  const [editing, setEditing] = useState<CycleEntry | null>(null)
  const [deleting, setDeleting] = useState<CycleEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editFlow, setEditFlow] = useState('medium')
  const [editNotes, setEditNotes] = useState('')

  if (cycles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No cycle history yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Your logged cycles will appear here. Log your first period to begin building your history.
        </p>
      </div>
    )
  }

  // Try to extract flow from notes for legacy entries; default to "Medium" if absent
  function parseFlow(notes?: string | null): string {
    if (!notes) return 'Medium'
    const lower = notes.toLowerCase()
    if (lower.includes('heavy')) return 'Heavy'
    if (lower.includes('light')) return 'Light'
    if (lower.includes('medium')) return 'Medium'
    return 'Medium'
  }

  function openEdit(cycle: CycleEntry) {
    setEditing(cycle)
    setEditStart(cycle.startDate)
    setEditEnd(cycle.endDate ?? '')
    setEditFlow(parseFlow(cycle.notes).toLowerCase())
    // Strip the flow prefix so the textarea only holds the free-text part.
    setEditNotes((cycle.notes ?? '').replace(/^(light|medium|heavy) flow\.?\s*/i, ''))
  }

  async function handleSaveEdit() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch('/api/cycles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing.id,
          startDate: editStart || undefined,
          endDate: editEnd || null,
          flow: editFlow,
          notes: editNotes,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update cycle')
      }
      toast.success('Cycle updated')
      setEditing(null)
      onChanged?.()
    } catch (e) {
      console.error('Failed to update cycle:', e)
      toast.error(e instanceof Error ? e.message : 'Could not update cycle')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    setSaving(true)
    try {
      const res = await fetch(`/api/cycles?id=${encodeURIComponent(deleting.id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete cycle')
      }
      toast.success('Cycle record deleted')
      setDeleting(null)
      onChanged?.()
    } catch (e) {
      console.error('Failed to delete cycle:', e)
      toast.error(e instanceof Error ? e.message : 'Could not delete cycle')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <div className="max-h-64 overflow-y-auto overflow-x-auto custom-scrollbar">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Start Date</TableHead>
              <TableHead className="text-xs hidden sm:table-cell">End Date</TableHead>
              <TableHead className="text-xs text-center">Period</TableHead>
              <TableHead className="text-xs text-center hidden sm:table-cell">Cycle</TableHead>
              <TableHead className="text-xs">Flow</TableHead>
              <TableHead className="w-10" aria-label="Row actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cycles.map((cycle) => (
              <TableRow
                key={cycle.id}
                className="group hover:bg-rose-50/60 dark:hover:bg-rose-950/20 transition-colors"
              >
                <TableCell className="text-xs font-medium">
                  {format(new Date(cycle.startDate), 'MMM d, yy')}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                  {cycle.endDate ? format(new Date(cycle.endDate), 'MMM d, yy') : '—'}
                </TableCell>
                <TableCell className="text-xs text-center">
                  <Badge variant="outline" className="text-[10px] px-1.5 border-rose-200 text-rose-600">
                    {cycle.periodLength}d
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-center hidden sm:table-cell">
                  <Badge variant="outline" className="text-[10px] px-1.5">
                    {cycle.cycleLength}d
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {(() => {
                    const flow = parseFlow(cycle.notes)
                    return (
                      <span
                        className={`inline-flex items-center gap-1 ${
                          flow === 'Heavy'
                            ? 'text-rose-600'
                            : flow === 'Medium'
                            ? 'text-pink-500'
                            : 'text-pink-400'
                        }`}
                      >
                        <Droplets className="h-3 w-3" />
                        {flow}
                      </span>
                    )
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        aria-label={`Actions for cycle starting ${format(new Date(cycle.startDate), 'MMM d, yy')}`}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground/50 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40 transition-all data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem
                        onClick={() => openEdit(cycle)}
                        className="gap-2 text-xs cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5 text-rose-500" />
                        Edit cycle
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleting(cycle)}
                        className="gap-2 text-xs cursor-pointer text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit dialog */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-950/40">
                <Pencil className="h-3.5 w-3.5 text-rose-600" />
              </span>
              Edit cycle record
            </DialogTitle>
            <DialogDescription className="text-xs">
              Correct dates or flow — predictions and your dashboard update automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cycle-edit-start" className="text-xs font-medium">
                  Start date
                </Label>
                <Input
                  id="cycle-edit-start"
                  type="date"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cycle-edit-end" className="text-xs font-medium">
                  End date
                </Label>
                <Input
                  id="cycle-edit-end"
                  type="date"
                  value={editEnd}
                  min={editStart || undefined}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Flow intensity</Label>
              <Select value={editFlow} onValueChange={setEditFlow}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <span className="inline-flex items-center gap-2">
                      <Droplets className="h-3 w-3 text-pink-300" /> Light
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="inline-flex items-center gap-2">
                      <Droplets className="h-3 w-3 text-pink-500" /> Medium
                    </span>
                  </SelectItem>
                  <SelectItem value="heavy">
                    <span className="inline-flex items-center gap-2">
                      <Droplets className="h-3 w-3 text-rose-600" /> Heavy
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cycle-edit-notes" className="text-xs font-medium">
                Notes
              </Label>
              <Textarea
                id="cycle-edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Cramps, mood, anything worth remembering…"
                className="min-h-[64px] text-xs resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-rose-500 hover:bg-rose-600 text-white"
              disabled={saving || !editStart}
              onClick={handleSaveEdit}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </span>
              Delete this cycle record?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {deleting
                ? `The cycle starting ${format(new Date(deleting.startDate), 'MMM d, yyyy')} will be permanently removed. Predictions will recalculate from your remaining records.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Keep record</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete cycle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────

function EmptyStateHero({ onLogClick }: { onLogClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blush mb-4">
        <Droplets className="h-7 w-7 text-rose-500" />
      </div>
      <h3 className="text-lg font-semibold">Welcome to your Cycle Tracker</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">
        Log your first period to unlock cycle predictions, fertility windows, ovulation tracking, and personalized phase insights.
      </p>
      <Button className="mt-4 bg-rose-500 hover:bg-rose-600 text-white" onClick={onLogClick}>
        <Plus className="h-4 w-4 mr-2" />
        Log your first period
      </Button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────

export default function PeriodModule() {
  const userProfile = useAppStore((s) => s.userProfile)
  const [cycles, setCycles] = useState<CycleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

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
  }, [userProfile?.id, refreshKey])

  const defaultCycleLength = userProfile?.cycleLength ?? 28
  const defaultPeriodLength = userProfile?.periodLength ?? 5

  // Latest cycle = most recent startDate
  const latestCycle = cycles[0]
  const cycleStart = latestCycle ? new Date(latestCycle.startDate) : null
  const cycleLength = latestCycle?.cycleLength ?? defaultCycleLength
  const periodLength = latestCycle?.periodLength ?? defaultPeriodLength

  const cycleDay = useMemo(() => {
    if (!cycleStart) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(cycleStart)
    start.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    if (diffDays < 1) return null
    return ((diffDays - 1) % cycleLength) + 1
  }, [cycleStart, cycleLength])

  const refresh = () => setRefreshKey((k) => k + 1)

  return (
    <div className="w-full space-y-6 pb-4">
      {/* Hero: Cycle Wheel */}
      <Card className="card-blush overflow-hidden border-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <Droplets className="h-5 w-5" />
                Cycle Tracker
              </CardTitle>
              <CardDescription className="text-xs">
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
                {cycleDay ? ` — Day ${cycleDay} of ${cycleLength}` : ''}
              </CardDescription>
            </div>
            {cycleDay && (
              <Badge className="rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-0">
                <Clock className="h-3 w-3 mr-1" />
                {Math.max(0, cycleLength - cycleDay)} days left
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex justify-center pt-2 pb-6">
          {loading ? (
            <div className="h-[320px] sm:h-[380px] w-full animate-pulse rounded-2xl bg-muted/40" />
          ) : cycleDay ? (
            <CycleWheel cycleDay={cycleDay} cycleLength={cycleLength} />
          ) : (
            <EmptyStateHero onLogClick={() => {
              const tab = document.querySelector<HTMLButtonElement>('[data-log-tab="true"]')
              tab?.click()
            }} />
          )}
        </CardContent>
      </Card>

      {/* Main content tabs */}
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="w-full grid grid-cols-4 rounded-full bg-secondary p-1 h-auto">
          <TabsTrigger
            value="calendar"
            className="min-h-11 rounded-full text-xs gap-1.5 data-[state=inactive]:text-muted-foreground data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-[0_6px_18px_-6px_rgba(244,63,94,0.55)] dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-white dark:data-[state=active]:border-transparent"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Calendar</span>
          </TabsTrigger>
          <TabsTrigger
            value="timeline"
            className="min-h-11 rounded-full text-xs gap-1.5 data-[state=inactive]:text-muted-foreground data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-[0_6px_18px_-6px_rgba(244,63,94,0.55)] dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-white dark:data-[state=active]:border-transparent"
          >
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Timeline</span>
          </TabsTrigger>
          <TabsTrigger
            value="log"
            data-log-tab="true"
            className="min-h-11 rounded-full text-xs gap-1.5 data-[state=inactive]:text-muted-foreground data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-[0_6px_18px_-6px_rgba(244,63,94,0.55)] dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-white dark:data-[state=active]:border-transparent"
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Log</span>
          </TabsTrigger>
          <TabsTrigger
            value="symptoms"
            className="min-h-11 rounded-full text-xs gap-1.5 data-[state=inactive]:text-muted-foreground data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-[0_6px_18px_-6px_rgba(244,63,94,0.55)] dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-white dark:data-[state=active]:border-transparent"
          >
            <Heart className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Symptoms</span>
          </TabsTrigger>
        </TabsList>

        {/* Calendar Tab */}
        <TabsContent value="calendar">
          <Card className="glass border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-rose-500" />
                Cycle Calendar
              </CardTitle>
              <CardDescription className="text-xs">
                Track your period, ovulation, and fertile window
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cycleStart ? (
                <CycleCalendar
                  cycleStart={cycleStart}
                  cycleLength={cycleLength}
                  periodLength={periodLength}
                />
              ) : (
                <EmptyStateHero onLogClick={() => {
                  const tab = document.querySelector<HTMLButtonElement>('[data-log-tab="true"]')
                  tab?.click()
                }} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card className="glass border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-rose-500" />
                Cycle Timeline
              </CardTitle>
              <CardDescription className="text-xs">Your cycle phases and hormone levels</CardDescription>
            </CardHeader>
            <CardContent>
              {cycleDay ? (
                <CycleTimeline cycleDay={cycleDay} cycleLength={cycleLength} />
              ) : (
                <EmptyStateHero onLogClick={() => {
                  const tab = document.querySelector<HTMLButtonElement>('[data-log-tab="true"]')
                  tab?.click()
                }} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Log Tab */}
        <TabsContent value="log">
          <Card className="glass border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-rose-500" />
                Log Period
              </CardTitle>
              <CardDescription className="text-xs">Record your period details</CardDescription>
            </CardHeader>
            <CardContent>
              <LogPeriodSection
                userId={userProfile?.id}
                onLogged={refresh}
                defaultCycleLength={defaultCycleLength}
                defaultPeriodLength={defaultPeriodLength}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Symptoms Tab */}
        <TabsContent value="symptoms">
          <Card className="glass border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-500" />
                Symptom Quick Log
              </CardTitle>
              <CardDescription className="text-xs">
                Tap symptoms you are experiencing and rate their severity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SymptomQuickLog userId={userProfile?.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bottom row: Predictions + History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="glass border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-rose-500" />
              Period Predictions
            </CardTitle>
            <CardDescription className="text-xs">AI-powered cycle forecasting</CardDescription>
          </CardHeader>
          <CardContent>
            {cycleStart ? (
              <PeriodPredictions
                cycleStart={cycleStart}
                cycleLength={cycleLength}
                periodLength={periodLength}
                historyCount={cycles.length}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-2">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No predictions yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Log at least one period to enable next-period predictions and confidence scoring.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-rose-500" />
              Cycle History
            </CardTitle>
            <CardDescription className="text-xs">Your recent cycle records</CardDescription>
          </CardHeader>
          <CardContent className="px-2">
            <HistoricalCyclesTable cycles={cycles} onChanged={refresh} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
