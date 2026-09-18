'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import {
  MapPin,
  Stethoscope,
  Star,
  Phone,
  Video,
  Calendar as CalendarIcon,
  Clock,
  Search,
  Loader2,
  Filter,
  AlertTriangle,
  CheckCircle2,
  User,
  Award,
  Languages,
  Navigation,
  Heart,
  Activity,
  Brain,
  Baby,
  Sparkles,
  Zap,
  Siren,
  Eye,
  Droplet,
  Thermometer,
  Pill,
  Hospital,
  CircleDollarSign,
  Frown,
  Flame,
  Utensils,
  HandHeart,
  Crosshair,
  FlaskConical,
  ExternalLink,
  Globe,
  ChevronRight,
  MapPinned,
  MessageCircle,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Specialty =
  | 'Gynecologist'
  | 'Fertility Specialist'
  | 'Obstetrician'
  | 'Endocrinologist'
  | 'Nutritionist'
  | 'Dermatologist'
  | 'Mental Health Counselor'
  | 'General Physician'
  | 'Urologist'

type Severity = 'Mild' | 'Moderate' | 'Severe'

interface Doctor {
  id: string
  name: string
  specialty: Specialty
  qualifications: string
  experience: number
  rating: number
  reviews: number
  clinic: string
  address: string
  city: string
  area?: string
  distance: number
  fee: number
  nextSlotDay: 'Today' | 'Tomorrow' | 'Day After'
  nextSlotTime: string
  languages: string[]
  gender: 'Female' | 'Male'
  availableToday: boolean
  videoConsult: boolean
  onlineNow: boolean
  // Google Places powered fields
  openNow?: boolean | null
  phone?: string | null
  placeId?: string | null
  mapsUrl?: string
  website?: string | null
  lat?: number | null
  lng?: number | null
  types?: string[]
  photoUrl?: string | null
  source?: 'google' | 'empty'
}

interface AreaSuggestion {
  description: string
  mainText: string
  secondaryText: string
}

// ─── Helper: debounce ─────────────────────────────────────────────────────────
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let t: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

// ─── Specialty Metadata ───────────────────────────────────────────────────────

interface SpecialtyMeta {
  id: Specialty
  label: string
  shortLabel: string
  description: string
  icon: React.ElementType
  color: string
  bgColor: string
  borderColor: string
  textColor: string
}

const SPECIALTIES: SpecialtyMeta[] = [
  {
    id: 'Gynecologist',
    label: 'Gynecologist',
    shortLabel: 'Gynecologist',
    description: 'Period issues, PCOS, irregular cycles',
    icon: Stethoscope,
    color: '#0d9488',
    bgColor: 'bg-teal-50 dark:bg-teal-950/40',
    borderColor: 'border-teal-200 dark:border-teal-800',
    textColor: 'text-teal-700 dark:text-teal-300',
  },
  {
    id: 'Fertility Specialist',
    label: 'Fertility Specialist',
    shortLabel: 'Fertility',
    description: 'Conception, IVF, fertility tracking',
    icon: Baby,
    color: '#0891b2',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/40',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
    textColor: 'text-cyan-700 dark:text-cyan-300',
  },
  {
    id: 'Obstetrician',
    label: 'Obstetrician',
    shortLabel: 'Obstetrician',
    description: 'Pregnancy care, prenatal',
    icon: Heart,
    color: '#be123c',
    bgColor: 'bg-rose-50 dark:bg-rose-950/40',
    borderColor: 'border-rose-200 dark:border-rose-800',
    textColor: 'text-rose-700 dark:text-rose-300',
  },
  {
    id: 'Endocrinologist',
    label: 'Endocrinologist',
    shortLabel: 'Endocrine',
    description: 'Hormone issues, thyroid, PCOS',
    icon: Activity,
    color: '#7c3aed',
    bgColor: 'bg-violet-50 dark:bg-violet-950/40',
    borderColor: 'border-violet-200 dark:border-violet-800',
    textColor: 'text-violet-700 dark:text-violet-300',
  },
  {
    id: 'Nutritionist',
    label: 'Nutritionist/Dietitian',
    shortLabel: 'Nutritionist',
    description: 'Diet, weight management',
    icon: Utensils,
    color: '#16a34a',
    bgColor: 'bg-green-50 dark:bg-green-950/40',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor: 'text-green-700 dark:text-green-300',
  },
  {
    id: 'Dermatologist',
    label: 'Dermatologist',
    shortLabel: 'Dermatologist',
    description: 'Acne, skin issues related to hormones',
    icon: Sparkles,
    color: '#db2777',
    bgColor: 'bg-pink-50 dark:bg-pink-950/40',
    borderColor: 'border-pink-200 dark:border-pink-800',
    textColor: 'text-pink-700 dark:text-pink-300',
  },
  {
    id: 'Mental Health Counselor',
    label: 'Mental Health Counselor',
    shortLabel: 'Mental Health',
    description: 'Anxiety, depression, mood',
    icon: Brain,
    color: '#2563eb',
    bgColor: 'bg-sky-50 dark:bg-sky-950/40',
    borderColor: 'border-sky-200 dark:border-sky-800',
    textColor: 'text-sky-700 dark:text-sky-300',
  },
  {
    id: 'General Physician',
    label: 'General Physician',
    shortLabel: 'General Physician',
    description: 'General health',
    icon: Stethoscope,
    color: '#475569',
    bgColor: 'bg-slate-50 dark:bg-slate-950/40',
    borderColor: 'border-slate-200 dark:border-slate-800',
    textColor: 'text-slate-700 dark:text-slate-300',
  },
  {
    id: 'Urologist',
    label: 'Urologist',
    shortLabel: 'Urologist',
    description: 'Urinary issues',
    icon: Droplet,
    color: '#0284c7',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/40',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
    textColor: 'text-cyan-700 dark:text-cyan-300',
  },
]

const SPECIALTY_MAP: Record<Specialty, SpecialtyMeta> = SPECIALTIES.reduce(
  (acc, s) => ({ ...acc, [s.id]: s }),
  {} as Record<Specialty, SpecialtyMeta>
)

// ─── Health Concern Guide ─────────────────────────────────────────────────────

interface GuideEntry {
  specialty: Specialty
  whenToSee: string
  icon: React.ElementType
}

const SPECIALTY_GUIDE: GuideEntry[] = [
  {
    specialty: 'Gynecologist',
    whenToSee: 'Irregular periods, severe cramps, abnormal bleeding, pelvic pain, or routine annual check-ups.',
    icon: Stethoscope,
  },
  {
    specialty: 'Fertility Specialist',
    whenToSee: 'Trying to conceive for 12+ months (6+ months if over 35), PCOS with fertility concerns, or recurrent pregnancy loss.',
    icon: Baby,
  },
  {
    specialty: 'Endocrinologist',
    whenToSee: 'Hormone imbalances, thyroid issues (hypo/hyper), severe PCOS resistant to first-line treatment, or diabetes management.',
    icon: Activity,
  },
  {
    specialty: 'Obstetrician',
    whenToSee: 'Confirmed or suspected pregnancy, prenatal care, high-risk pregnancy monitoring, or postpartum follow-up.',
    icon: Heart,
  },
  {
    specialty: 'Mental Health Counselor',
    whenToSee: 'Persistent anxiety, low mood, mood swings affecting daily life, PMS/PMDD symptoms, or postpartum depression.',
    icon: Brain,
  },
  {
    specialty: 'Nutritionist',
    whenToSee: 'PCOS diet planning, weight management, gestational diabetes, or eating concerns tied to cycle changes.',
    icon: Utensils,
  },
]

const RED_FLAG_SYMPTOMS = [
  { text: 'Severe pelvic pain that doesn\'t subside', icon: Frown },
  { text: 'Heavy bleeding — soaking a pad in 1 hour', icon: Droplet },
  { text: 'Missed period with severe abdominal pain', icon: AlertTriangle },
  { text: 'Fever (≥101°F) with pelvic symptoms', icon: Thermometer },
  { text: 'Sudden severe headache, worse than usual', icon: Zap },
  { text: 'Vision changes, blurriness, or flashing lights', icon: Eye },
]

// ─── Hero Stat Chips (derived from module data — hydration-safe constants) ────

const HERO_STATS: { icon: React.ElementType; value: string; label: string }[] = [
  { icon: CheckCircle2, value: String(SPECIALTIES.length), label: 'Specialities' },
  { icon: HandHeart, value: String(SPECIALTY_GUIDE.length), label: 'Care guides' },
  { icon: Stethoscope, value: 'Trusted', label: 'Specialists' },
]

// ─── Time Slots for Booking ───────────────────────────────────────────────────

const TIME_SLOTS = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
  '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
  '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM',
]

// ─── Severity Config ──────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; border: string; ring: string; dot: string }> = {
  Mild: {
    label: 'Mild',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-300 dark:border-emerald-700',
    ring: 'ring-emerald-500',
    dot: 'bg-emerald-500',
  },
  Moderate: {
    label: 'Moderate',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-300 dark:border-amber-700',
    ring: 'ring-amber-500',
    dot: 'bg-amber-500',
  },
  Severe: {
    label: 'Severe',
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-300 dark:border-rose-700',
    ring: 'ring-rose-500',
    dot: 'bg-rose-500',
  },
}

// ─── Helper: Avatar Gradient ──────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  'from-teal-500 to-cyan-600',
  'from-rose-500 to-pink-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-green-600',
  'from-sky-500 to-blue-600',
  'from-fuchsia-500 to-pink-600',
  'from-cyan-500 to-teal-600',
]

function getAvatarGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}

function getInitials(name: string): string {
  const parts = name.replace(/^Dr\.\s*/i, '').split(' ')
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DoctorFinderModule() {
  const userProfile = useAppStore((s) => s.userProfile)
  // Search state
  const [location, setLocation] = useState('')
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null)
  const [severity, setSeverity] = useState<Severity | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchSource, setSearchSource] = useState<'google' | 'simulated' | null>(null)
  const [demoNoticeDismissed, setDemoNoticeDismissed] = useState(false)
  const [searchedLocation, setSearchedLocation] = useState('')

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<AreaSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [locating, setLocating] = useState(false)
  const suggestionsRef = React.useRef<HTMLDivElement | null>(null)
  // AbortController ref so rapid typing cancels stale geocode requests
  const suggestionsAbortRef = React.useRef<AbortController | null>(null)

  // Filter & sort state
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'experience' | 'fee'>('distance')
  const [filterToday, setFilterToday] = useState(false)
  const [filterVideo, setFilterVideo] = useState(false)
  const [filterFemale, setFilterFemale] = useState(false)
  const [filterOpenNow, setFilterOpenNow] = useState(false)
  const [maxFee, setMaxFee] = useState<'any' | '500' | '800' | '1200'>('any')

  // Booking dialog state
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null)
  const [bookingDate, setBookingDate] = useState<Date | undefined>(undefined)
  const [bookingTime, setBookingTime] = useState<string>('')
  const [bookingReason, setBookingReason] = useState('')
  const [bookingConfirmed, setBookingConfirmed] = useState(false)
  const [bookingSaving, setBookingSaving] = useState(false)
  // Keys of `${doctorName}|${YYYY-MM-DD}|${slot}` the user has ALREADY booked —
  // used to grey out slots in the picker and block duplicate submissions.
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set())

  // ─── Location autocomplete ──────────────────────────────────────────────
  const fetchSuggestions = React.useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([])
      return
    }
    // Cancel any in-flight request so a slow earlier response can't
    // overwrite the result of a newer one (rapid-typing race condition).
    suggestionsAbortRef.current?.abort()
    const controller = new AbortController()
    suggestionsAbortRef.current = controller
    try {
      const res = await fetch(`/api/doctors/geocode?q=${encodeURIComponent(q.trim())}`, {
        signal: controller.signal,
      })
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (e: unknown) {
      // AbortError is expected when a newer keystroke supersedes this request;
      // swallow it silently. Anything else stays silent to match prior behavior.
      const name = (e as { name?: string })?.name
      if (name !== 'AbortError') {
        // silent
      }
    }
  }, [])

  const debouncedFetch = React.useRef(
    debounce((q: string) => fetchSuggestions(q), 250)
  ).current

  const handleLocationChange = (val: string) => {
    setLocation(val)
    setShowSuggestions(true)
    debouncedFetch(val)
  }

  const selectSuggestion = (s: AreaSuggestion) => {
    setLocation(s.description)
    setShowSuggestions(false)
    setSuggestions([])
  }

  // ─── Use my current location ────────────────────────────────────────────
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setSearchError('Geolocation is not supported on this device.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/doctors/geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
          )
          if (res.ok) {
            const data = await res.json()
            setLocation(data.formatted || `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`)
          } else {
            setLocation(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`)
          }
        } catch {
          setLocation(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`)
        } finally {
          setLocating(false)
        }
      },
      () => {
        setLocating(false)
        setSearchError('Could not access your location. Please enter it manually.')
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  // ─── Fetch doctors from API ─────────────────────────────────────────────
  const fetchDoctors = async (loc: string, spec: Specialty | null) => {
    setIsSearching(true)
    setSearchError(null)
    setHasSearched(false)
    setSearchedLocation(loc)
    try {
      const params = new URLSearchParams({ location: loc })
      if (spec) params.set('specialty', spec)
      const res = await fetch(`/api/doctors/search?${params.toString()}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Search failed')
      setDoctors(data.doctors || [])
      setSearchSource(data.source || null)
      setDemoNoticeDismissed(false)
      setHasSearched(true)
    } catch (e: any) {
      setSearchError(e?.message || 'Something went wrong. Please try again.')
      setDoctors([])
      setHasSearched(true)
    } finally {
      setIsSearching(false)
    }
  }

  // Derived: filtered + sorted doctors
  const filteredDoctors = useMemo(() => {
    if (!hasSearched) return []
    let list = [...doctors]

    // Apply filter bar filters
    if (filterToday) list = list.filter((d) => d.availableToday)
    if (filterVideo) list = list.filter((d) => d.videoConsult)
    if (filterFemale) list = list.filter((d) => d.gender === 'Female')
    if (filterOpenNow) list = list.filter((d) => d.openNow === true)
    if (maxFee !== 'any') {
      const cap = parseInt(maxFee, 10)
      list = list.filter((d) => d.fee <= cap)
    }

    // Sort
    list.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating
        case 'experience':
          return b.experience - a.experience
        case 'fee':
          return a.fee - b.fee
        case 'distance':
        default:
          return a.distance - b.distance
      }
    })

    return list
  }, [hasSearched, doctors, filterToday, filterVideo, filterFemale, filterOpenNow, maxFee, sortBy])

  // Online-now doctors for telehealth quick connect
  const onlineDoctors = useMemo(() => doctors.filter((d) => d.onlineNow).slice(0, 3), [doctors])

  const isSevere = severity === 'Severe'

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleSearch = () => {
    if (!location.trim()) {
      setSearchError('Please enter your area or city to find doctors nearby.')
      return
    }
    setShowSuggestions(false)
    fetchDoctors(location.trim(), selectedSpecialty)
  }

  const handleSelectSpecialty = (s: Specialty) => {
    setSelectedSpecialty((cur) => (cur === s ? null : s))
  }

  const dateKey = (d: Date) => d.toISOString().split('T')[0]
  const slotKey = (doctor: string, d: Date, time: string) => `${doctor}|${dateKey(d)}|${time}`

  const openBooking = (doctor: Doctor) => {
    setBookingDoctor(doctor)
    setBookingDate(undefined)
    setBookingTime('')
    setBookingReason('')
    setBookingConfirmed(false)
    setBookedSlots(new Set())
    // Load existing appointments so already-booked slots appear disabled.
    const userId = userProfile?.id
    if (userId) {
      fetch(`/api/appointments?userId=${userId}`)
        .then((r) => (r.ok ? r.json() : Promise.resolve([])))
        .then((appts: Array<{ doctorName: string; date: string; time: string; status: string }>) => {
          const keys = new Set<string>()
          for (const a of Array.isArray(appts) ? appts : []) {
            if (a.status && a.status !== 'cancelled') {
              keys.add(`${a.doctorName}|${a.date}|${a.time}`)
            }
          }
          setBookedSlots(keys)
        })
        .catch(() => {})
    }
  }

  const closeBooking = () => {
    setBookingDoctor(null)
    setTimeout(() => setBookingConfirmed(false), 200)
  }

  const confirmBooking = async () => {
    if (!bookingDate || !bookingTime || !bookingDoctor) return
    const userId = userProfile?.id
    if (!userId) {
      toast.error('Please sign in to book an appointment')
      return
    }
    // Client-side de-dupe: block booking a slot already on the calendar.
    if (bookedSlots.has(slotKey(bookingDoctor.name, bookingDate, bookingTime))) {
      toast.error('That slot is already booked', {
        description: 'Pick a different date or time for this doctor.',
      })
      return
    }
    setBookingSaving(true)
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          doctorName: bookingDoctor.name,
          specialty: bookingDoctor.specialty,
          date: bookingDate.toISOString().split('T')[0],
          time: bookingTime,
          type: bookingDoctor.videoConsult ? 'video' : 'in_person',
          notes: bookingReason.trim() || undefined,
        }),
      })
      if (res.status === 409) {
        // Server-side de-dupe triggered — sync the booked set and prompt retry.
        setBookedSlots((prev) => new Set(prev).add(slotKey(bookingDoctor.name, bookingDate, bookingTime)))
        setBookingTime('')
        toast.error('That slot is already booked', {
          description: 'Please choose a different date or time.',
        })
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Booking failed')
      }
      setBookedSlots((prev) => new Set(prev).add(slotKey(bookingDoctor.name, bookingDate, bookingTime)))
      setBookingConfirmed(true)
      toast.success('Appointment booked! 🎉', {
        description: `${bookingDoctor.name} · ${bookingDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at ${bookingTime}. See it on your dashboard.`,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not book appointment')
    } finally {
      setBookingSaving(false)
    }
  }

  const canConfirm = bookingDate && bookingTime

  // Close suggestions on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-4">
      {/* ═══ 1. HERO BAND ═══ */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,oklch(0.45_0.09_205)_0%,oklch(0.55_0.11_205)_100%)] p-4 text-white shadow-xl shadow-medical/30 sm:p-6 dark:bg-[linear-gradient(135deg,oklch(0.30_0.06_205)_0%,oklch(0.42_0.09_205)_100%)]">
          {/* Decorative light blooms */}
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-white/5 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            {/* Title cluster */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 shadow-inner backdrop-blur-md">
                <Stethoscope aria-hidden="true" className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                  Find Your Doctor
                </h1>
                <p className="mt-1 text-sm text-white/80 md:text-base">
                  Connect with trusted healthcare specialists near you
                </p>
                {/* Floating quick-action orbs (decorative, per reference) */}
                <div aria-hidden="true" className="mt-4 hidden items-center gap-2.5 sm:flex">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur-md">
                    <MessageCircle className="h-4.5 w-4.5 text-white/90" />
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur-md">
                    <Phone className="h-4.5 w-4.5 text-white/90" />
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur-md">
                    <Video className="h-4.5 w-4.5 text-white/90" />
                  </span>
                </div>
              </div>
            </div>

            {/* Frosted glass stat chips */}
            <div className="flex flex-wrap gap-2.5 md:flex-col lg:flex-row">
              {HERO_STATS.map((stat) => {
                const StatIcon = stat.icon
                return (
                  <div
                    key={stat.label}
                    className="flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 py-1.5 pl-1.5 pr-4 backdrop-blur-md"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
                      <StatIcon aria-hidden="true" className="h-4.5 w-4.5" />
                    </span>
                    <span className="leading-tight">
                      <span className="block text-sm font-bold text-white">{stat.value}</span>
                      <span className="block text-[10px] font-medium uppercase tracking-wide text-white/70">
                        {stat.label}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Emergency notice — frosted pill row inside the hero (safety copy unchanged) */}
          <div className="relative mt-5 flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md">
            <Siren aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" />
            <p className="text-sm font-medium text-white">
              🚨 For medical emergencies, call your local emergency number immediately
              <span className="mt-0.5 block text-xs font-normal text-white/75">
                India: 108 / 112 · US: 911 · UK: 999 · EU: 112
              </span>
            </p>
          </div>
        </div>
      </motion.header>

      {/* ═══ 2. SEARCH SECTION ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <Card className="card-medical">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-medical text-medical-foreground shadow-md shadow-medical/25">
                <Search className="h-4 w-4" />
              </span>
              Search Healthcare Providers
            </CardTitle>
            <CardDescription>
              Tell us what you need and we&apos;ll find the right specialist for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Location input with autocomplete + use my location */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="location" className="flex items-center gap-1.5 text-sm font-medium">
                  <MapPin className="h-3.5 w-3.5 text-medical" />
                  Your Location
                </Label>
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-medical-soft px-3.5 py-1.5 text-xs font-semibold text-medical transition-all hover:bg-medical hover:text-medical-foreground disabled:opacity-50"
                >
                  {locating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Crosshair className="h-3.5 w-3.5" />
                  )}
                  {locating ? 'Locating...' : 'Use my location'}
                </button>
              </div>
              <div className="relative" ref={suggestionsRef}>
                <MapPin className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-medical" />
                <Input
                  id="location"
                  placeholder="Enter your area or city (works for any location in India)"
                  value={location}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSearch()
                    }
                  }}
                  className="h-12 rounded-full border-medical/30 bg-card/80 pl-11 pr-12 shadow-sm focus-visible:border-medical focus-visible:ring-medical/25"
                />
                {location && (
                  <button
                    type="button"
                    onClick={() => { setLocation(''); setSuggestions([]); }}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-medical-soft hover:text-foreground"
                    aria-label="Clear location"
                  >
                    ×
                  </button>
                )}
                {/* Autocomplete dropdown */}
                <AnimatePresence>
                  {showSuggestions && suggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-30 mt-1 w-full overflow-hidden rounded-2xl border border-medical/25 bg-popover shadow-xl"
                    >
                      <div className="flex items-center gap-1 border-b border-medical/20 bg-medical-soft/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-medical">
                        <MapPinned className="h-3 w-3" /> Powered by Google Places
                      </div>
                      <ul className="max-h-64 overflow-y-auto chandracycle-scroll">
                        {suggestions.map((s, i) => (
                          <li key={i}>
                            <button
                              type="button"
                              onClick={() => selectSuggestion(s)}
                              className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-medical-soft/70"
                            >
                              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-medical" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{s.mainText}</p>
                                {s.secondaryText && (
                                  <p className="text-xs text-muted-foreground truncate">{s.secondaryText}</p>
                                )}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {searchError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" /> {searchError}
                </p>
              )}
            </div>

            {/* Specialty selector grid */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Stethoscope className="h-3.5 w-3.5 text-medical" />
                Health Concern
              </Label>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {SPECIALTIES.map((s) => {
                  const Icon = s.icon
                  const isSelected = selectedSpecialty === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSpecialty(s.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all duration-200',
                        isSelected
                          ? 'border-transparent bg-medical text-medical-foreground shadow-lg shadow-medical/30'
                          : 'border-transparent bg-medical-soft text-foreground hover:-translate-y-0.5 hover:shadow-md'
                      )}
                    >
                      <div className="flex w-full items-center gap-2">
                        <span
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                            isSelected ? 'bg-white/20 text-medical-foreground' : 'bg-card text-medical shadow-sm'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="ml-auto h-4 w-4 text-medical-foreground" />
                        )}
                      </div>
                      <span className="text-xs font-semibold leading-tight">{s.shortLabel}</span>
                      <span className={cn('text-[10px] leading-tight line-clamp-2', isSelected ? 'text-medical-foreground/80' : 'text-muted-foreground')}>
                        {s.description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Severity level */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Activity className="h-3.5 w-3.5 text-medical" />
                Severity Level
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(SEVERITY_CONFIG) as Severity[]).map((sev) => {
                  const cfg = SEVERITY_CONFIG[sev]
                  const isSelected = severity === sev
                  return (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSeverity((cur) => (cur === sev ? null : sev))}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex min-h-11 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold transition-all',
                        isSelected
                          ? 'bg-medical text-medical-foreground shadow-lg shadow-medical/30'
                          : 'bg-medical-soft text-foreground hover:bg-medical-soft/70'
                      )}
                    >
                      <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Severe warning */}
            <AnimatePresence>
              {isSevere && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-start gap-3 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3">
                    <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-rose-800 dark:text-rose-200">
                        Your symptoms seem severe.
                      </p>
                      <p className="text-rose-700 dark:text-rose-300 mt-0.5">
                        We recommend booking an appointment soon. Consider{' '}
                        <span className="font-semibold">teleconsultation</span> for immediate advice.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search button */}
            <Button
              size="lg"
              onClick={handleSearch}
              disabled={isSearching || !location.trim()}
              className="h-12 w-full rounded-full bg-medical text-base text-medical-foreground shadow-lg shadow-medical/30 hover:bg-medical/90"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  Find Doctors
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ PRE-SEARCH EMPTY STATE ═══ */}
      {/* A brand-new user (no search performed yet) sees a friendly hint card
          in place of results — no fake doctor listings. */}
      <AnimatePresence>
        {!hasSearched && !isSearching && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
          >
            <Card className="rounded-3xl border-dashed border-medical/40 bg-medical-soft/40 dark:border-medical/30 dark:bg-medical-soft/20">
              <CardContent className="flex flex-col items-center justify-center px-4 py-14 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-medical text-medical-foreground shadow-lg shadow-medical/25">
                  <Search className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-foreground">Search to find doctors near you</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Enter your area or city above, optionally pick a health concern, then tap
                  &ldquo;Find Doctors&rdquo; — we&rsquo;ll surface verified specialists from
                  Google Places with real clinic details, fees, and availability.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ 5. TELEHEALTH QUICK CONNECT ═══ */}
      <AnimatePresence>
        {hasSearched && isSevere && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
          >
            <Card className="card-medical">
              <CardContent className="p-5 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="relative">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-medical text-medical-foreground shadow-md shadow-medical/30">
                        <Video className="h-6 w-6" />
                      </div>
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">
                        Need immediate advice? Connect with a doctor in 2 minutes
                      </h3>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-medical">
                        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Video Consult Available Now
                      </p>
                    </div>
                  </div>
                  <Button className="shrink-0 rounded-full bg-medical text-medical-foreground shadow-md hover:bg-medical/90">
                    <Video className="h-4 w-4" />
                    Start Video Consult
                  </Button>
                </div>

                <Separator className="my-4 bg-medical/20" />

                {/* Online doctors */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-medical">
                    Available Right Now
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {onlineDoctors.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2.5 rounded-2xl border border-medical/20 bg-card/70 p-2.5"
                      >
                        <div className="relative shrink-0">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className={cn('bg-gradient-to-br text-white font-semibold text-xs', getAvatarGradient(doc.name))}>
                              {getInitials(doc.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-card" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">{doc.name}</p>
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="h-4 text-[10px] px-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Online
                            </Badge>
                            <span className="text-[10px] text-muted-foreground truncate">{SPECIALTY_MAP[doc.specialty].shortLabel}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ 3 & 4. RESULTS + FILTER BAR ═══ */}
      <AnimatePresence>
        {hasSearched && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Visible demo-directory notice (simulated source) */}
            <AnimatePresence>
              {searchSource === 'simulated' && !demoNoticeDismissed && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="relative overflow-hidden rounded-2xl border border-amber-300/70 dark:border-amber-800 bg-gradient-to-r from-amber-50 via-amber-50/60 to-transparent dark:from-amber-950/30 dark:via-amber-950/20 px-4 py-3"
                  role="note"
                  aria-label="Demo directory notice"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                      <FlaskConical className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        Demo directory
                        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                          Sample data
                        </span>
                      </p>
                      <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                        Google Places isn&apos;t configured, so these are sample listings shown for
                        demonstration. Always verify a doctor&apos;s credentials independently before booking.
                      </p>
                    </div>
                    <button
                      onClick={() => setDemoNoticeDismissed(true)}
                      aria-label="Dismiss demo notice"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-amber-700/70 transition-colors hover:bg-amber-100 hover:text-amber-900 dark:hover:bg-amber-900/40"
                    >
                      ✕
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Filter & Sort Bar */}
            <Card className="card-medical">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  {/* Results count + location + source */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-base font-bold text-medical">{filteredDoctors.length}</span>
                      <span className="text-muted-foreground">doctors found</span>
                      {selectedSpecialty && (
                        <Badge variant="secondary" className="ml-1 rounded-full bg-medical-soft text-medical">
                          {SPECIALTY_MAP[selectedSpecialty].shortLabel}
                        </Badge>
                      )}
                    </div>
                    {searchedLocation && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 text-medical" />
                        <span className="truncate max-w-[260px]">{searchedLocation}</span>
                        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-medical-soft px-1.5 py-0.5 text-[10px] font-medium text-medical">
                          <Globe className="h-2.5 w-2.5" />
                          {searchSource === 'google'
                            ? 'Google Places'
                            : searchSource === 'simulated'
                              ? 'Demo listings'
                              : 'Live results'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1" />

                  {/* Sort */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Filter className="h-3.5 w-3.5" /> Sort:
                    </span>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                      <SelectTrigger className="h-9 w-[140px] rounded-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="distance">Distance</SelectItem>
                        <SelectItem value="rating">Rating</SelectItem>
                        <SelectItem value="experience">Experience</SelectItem>
                        <SelectItem value="fee">Fee (Low to High)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator className="bg-medical/15" />

                {/* Filter toggles */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium mr-1">Filters:</span>
                  <FilterToggle
                    active={filterToday}
                    onClick={() => setFilterToday((v) => !v)}
                    icon={CalendarIcon}
                    label="Available Today"
                  />
                  <FilterToggle
                    active={filterOpenNow}
                    onClick={() => setFilterOpenNow((v) => !v)}
                    icon={Clock}
                    label="Open Now"
                  />
                  <FilterToggle
                    active={filterVideo}
                    onClick={() => setFilterVideo((v) => !v)}
                    icon={Video}
                    label="Video Consult"
                  />
                  <FilterToggle
                    active={filterFemale}
                    onClick={() => setFilterFemale((v) => !v)}
                    icon={User}
                    label="Female Doctor"
                  />
                  <div className="flex items-center gap-1.5 ml-1">
                    <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select value={maxFee} onValueChange={(v) => setMaxFee(v as typeof maxFee)}>
                      <SelectTrigger className="h-9 w-[110px] rounded-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any Fee</SelectItem>
                        <SelectItem value="500">≤ ₹500</SelectItem>
                        <SelectItem value="800">≤ ₹800</SelectItem>
                        <SelectItem value="1200">≤ ₹1200</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Doctor cards */}
            {isSearching ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="card-medical rounded-3xl">
                    <CardContent className="p-5">
                      <div className="flex gap-4">
                        <div className="h-16 w-16 rounded-2xl bg-medical-soft" />
                        <div className="flex-1 space-y-2.5 pt-1">
                          <div className="h-4 w-1/2 rounded-full bg-medical-soft" />
                          <div className="h-3 w-1/3 rounded-full bg-medical-soft/80" />
                          <div className="h-3 w-2/3 rounded-full bg-medical-soft/60" />
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="h-14 rounded-2xl bg-medical-soft/50" />
                        <div className="h-14 rounded-2xl bg-medical-soft/50" />
                        <div className="h-14 rounded-2xl bg-medical-soft/50" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredDoctors.length === 0 ? (
              <Card className="rounded-3xl border-dashed border-medical/40 bg-medical-soft/30 dark:border-medical/30 dark:bg-medical-soft/20">
                <CardContent className="py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-medical-soft text-medical">
                    <Search className="h-7 w-7" />
                  </div>
                  <p className="mt-3 font-semibold">No doctors match your filters</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try adjusting your filters or searching a different area.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4 rounded-full border-medical/30 hover:bg-medical-soft hover:text-medical dark:border-medical/40 dark:hover:bg-medical-soft/70 dark:hover:text-medical"
                    onClick={() => {
                      setFilterToday(false)
                      setFilterOpenNow(false)
                      setFilterVideo(false)
                      setFilterFemale(false)
                      setMaxFee('any')
                    }}
                  >
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredDoctors.map((doc, idx) => (
                  <DoctorCard
                    key={doc.id}
                    doctor={doc}
                    index={idx}
                    onBook={() => openBooking(doc)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ 6. HEALTH CONCERN GUIDE ═══ */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2">
          <HandHeart className="h-5 w-5 text-medical" />
          <h2 className="text-xl font-bold">Health Concern Guide</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {SPECIALTY_GUIDE.map((entry, idx) => {
            const meta = SPECIALTY_MAP[entry.specialty]
            const Icon = entry.icon
            return (
              <motion.div
                key={entry.specialty}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
              >
                <Card className={cn('card-medical h-full transition-shadow hover:shadow-lg')}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center gap-2.5">
                      <span className={cn('flex h-9 w-9 items-center justify-center rounded-full', meta.bgColor, meta.textColor)}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-semibold text-sm leading-tight">{meta.label}</p>
                        <p className="text-[11px] text-muted-foreground">See a {meta.shortLabel} if:</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{entry.whenToSee}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Red Flag Symptoms */}
        <Card className="rounded-3xl border-rose-200 dark:border-rose-900 bg-gradient-to-br from-rose-50 to-orange-50/50 dark:from-rose-950/40 dark:to-orange-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-rose-800 dark:text-rose-200">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-950">
                <Flame className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </span>
              Red Flag Symptoms
            </CardTitle>
            <CardDescription className="text-rose-700/80 dark:text-rose-300/80">
              Seek <strong>immediate medical attention</strong> if you experience any of these:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RED_FLAG_SYMPTOMS.map((sym) => {
                const Icon = sym.icon
                return (
                  <div
                    key={sym.text}
                    className="flex items-start gap-2.5 rounded-lg bg-white/70 dark:bg-card/60 border border-rose-100 dark:border-rose-900/50 px-3 py-2"
                  >
                    <Icon className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-rose-900 dark:text-rose-100">{sym.text}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-100/60 dark:bg-rose-950/40 rounded-lg px-3 py-2">
              <Siren className="h-4 w-4 shrink-0" />
              <span>Do not wait — these symptoms may indicate a serious condition requiring urgent care.</span>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* ═══ 7. APPOINTMENT BOOKING DIALOG ═══ */}
      <Dialog open={!!bookingDoctor} onOpenChange={(open) => !open && closeBooking()}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          {bookingDoctor && !bookingConfirmed && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-medical" />
                  Book Appointment
                </DialogTitle>
                <DialogDescription>
                  Choose a date and time that works for you.
                </DialogDescription>
              </DialogHeader>

              {/* Doctor summary */}
              <div className="flex items-start gap-3 rounded-2xl border border-medical/25 bg-medical-soft/50 p-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className={cn('bg-gradient-to-br text-white font-semibold', getAvatarGradient(bookingDoctor.name))}>
                    {getInitials(bookingDoctor.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{bookingDoctor.name}</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">{bookingDoctor.qualifications}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <Badge variant="secondary" className={cn('rounded-full text-[10px]', SPECIALTY_MAP[bookingDoctor.specialty].bgColor, SPECIALTY_MAP[bookingDoctor.specialty].textColor)}>
                      {SPECIALTY_MAP[bookingDoctor.specialty].shortLabel}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Hospital className="h-3 w-3" /> {bookingDoctor.clinic}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-medical">₹{bookingDoctor.fee}</p>
                  <p className="text-[10px] text-muted-foreground">consultation</p>
                </div>
              </div>

              {/* Date picker */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-medical" /> Select Date
                </Label>
                <div className="flex justify-center rounded-2xl border border-medical/25 bg-background p-2">
                  <Calendar
                    mode="single"
                    selected={bookingDate}
                    onSelect={setBookingDate}
                    disabled={(date) => {
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      const max = new Date(today)
                      max.setDate(max.getDate() + 14)
                      return date < today || date > max
                    }}
                    className="mx-auto"
                  />
                </div>
              </div>

              {/* Time slot */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-medical" /> Select Time Slot
                </Label>
                <div className="grid max-h-36 grid-cols-4 gap-2 overflow-y-auto p-0.5">
                  {TIME_SLOTS.map((slot) => {
                    const isSelected = bookingTime === slot
                    const isBooked =
                      !!bookingDate &&
                      !!bookingDoctor &&
                      bookedSlots.has(slotKey(bookingDoctor.name, bookingDate, slot))
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={!bookingDate || isBooked}
                        onClick={() => setBookingTime(slot)}
                        title={isBooked ? 'You already have an appointment at this time' : undefined}
                        className={cn(
                          'min-h-10 rounded-full border px-3 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40',
                          isSelected
                            ? 'border-transparent bg-medical text-medical-foreground shadow-md shadow-medical/30'
                            : isBooked
                              ? 'border-transparent bg-muted/40 text-muted-foreground line-through'
                              : 'border-medical/20 bg-card hover:border-medical/40 hover:bg-medical-soft'
                        )}
                      >
                        {slot}
                      </button>
                    )
                  })}
                </div>
                {!bookingDate && (
                  <p className="text-[11px] text-muted-foreground">Pick a date to see available slots.</p>
                )}
                {bookingDate && bookedSlots.size > 0 && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />
                    Crossed-out slots are already booked by you.
                  </p>
                )}
              </div>

              {/* Reason for visit */}
              <div className="space-y-2">
                <Label htmlFor="reason" className="text-sm font-medium flex items-center gap-1.5">
                  <Pill className="h-3.5 w-3.5 text-medical" /> Reason for Visit
                </Label>
                <Textarea
                  id="reason"
                  placeholder="Briefly describe your symptoms or reason for the consultation..."
                  value={bookingReason}
                  onChange={(e) => setBookingReason(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <DialogFooter className="gap-2">
                <DialogClose asChild>
                  <Button variant="outline" className="rounded-full">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={() => confirmBooking()}
                  disabled={!canConfirm || bookingSaving}
                  className="rounded-full bg-medical text-medical-foreground hover:bg-medical/90"
                >
                  {bookingSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Booking…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirm Appointment
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {bookingDoctor && bookingConfirmed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="py-6 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30"
              >
                <CheckCircle2 className="h-9 w-9 text-white" />
              </motion.div>
              <DialogTitle className="mt-4 text-xl">Appointment booked!</DialogTitle>
              <DialogDescription className="mt-1">
                You&apos;ll receive a confirmation shortly.
              </DialogDescription>

              <div className="mt-4 space-y-1.5 rounded-2xl border border-medical/20 bg-medical-soft/40 p-3 text-left text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Doctor</span>
                  <span className="font-medium">{bookingDoctor.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">
                    {bookingDate?.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Time</span>
                  <span className="font-medium">{bookingTime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="font-medium text-medical">₹{bookingDoctor.fee}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium text-right text-xs">{bookingDoctor.clinic}, {bookingDoctor.city}</span>
                </div>
              </div>

              <Button onClick={closeBooking} className="mt-5 w-full rounded-full bg-medical text-medical-foreground hover:bg-medical/90">
                Done
              </Button>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Sub-component: Filter Toggle ─────────────────────────────────────────────

function FilterToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all',
        active
          ? 'bg-medical text-medical-foreground shadow-md shadow-medical/25'
          : 'bg-medical-soft/60 text-foreground hover:bg-medical-soft'
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
      {active && <CheckCircle2 className="h-3 w-3" />}
    </button>
  )
}

// ─── Sub-component: Doctor Card ───────────────────────────────────────────────

function DoctorCard({
  doctor,
  index,
  onBook,
}: {
  doctor: Doctor
  index: number
  onBook: () => void
}) {
  const meta = SPECIALTY_MAP[doctor.specialty]
  const Icon = meta.icon

  // Reference-style stat chips — mapped strictly to existing Doctor data fields.
  const statChips: { icon: React.ElementType; value: string; label: string }[] = [
    { icon: Award, value: `${doctor.experience}`, label: 'Yrs Experience' },
    { icon: Star, value: `${doctor.reviews}`, label: 'Reviews' },
    { icon: Navigation, value: `${doctor.distance}`, label: 'Km Away' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.06, 0.4) }}
      className="h-full"
    >
      <Card className="h-full rounded-3xl border-border/60 bg-card shadow-md shadow-medical/5 transition-all hover:-translate-y-0.5 hover:border-medical/40 hover:shadow-xl hover:shadow-medical/15">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          {/* Top: teal gradient avatar block + name + badges */}
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-700 shadow-md shadow-medical/30 dark:from-teal-600 dark:to-cyan-800">
                <span className="font-serif text-xl font-bold text-white">{getInitials(doctor.name)}</span>
              </div>
              {doctor.onlineNow && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-card" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold leading-tight">{doctor.name}</h3>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{doctor.qualifications}</p>
                </div>
                <Badge variant="secondary" className={cn('shrink-0 rounded-full border text-[10px]', meta.bgColor, meta.textColor, meta.borderColor)}>
                  <Icon className="h-3 w-3" />
                  {meta.shortLabel}
                </Badge>
              </div>

              {/* Rating + gender pills */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                  aria-label={`Rated ${doctor.rating} out of 5`}
                >
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {doctor.rating}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-medical-soft px-2 py-0.5 text-[10px] font-semibold text-medical">
                  <User className="h-3 w-3" />
                  {doctor.gender}
                </span>
              </div>
            </div>
          </div>

          {/* Stats row — 3 icon-chips (Experience / Reviews / Distance) */}
          <div className="grid grid-cols-3 gap-2">
            {statChips.map((chip) => {
              const ChipIcon = chip.icon
              return (
                <div key={chip.label} className="flex items-center gap-2 rounded-2xl bg-medical-soft/70 px-2.5 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-medical shadow-sm">
                    <ChipIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-sm font-bold">{chip.value}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{chip.label}</span>
                  </span>
                </div>
              )
            })}
          </div>

          {/* Clinic + address + languages */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-start gap-2">
              <Hospital className="mt-0.5 h-3.5 w-3.5 shrink-0 text-medical" />
              <span className="font-semibold leading-tight">{doctor.clinic}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="leading-tight text-muted-foreground">
                {doctor.address}, {doctor.city}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Languages className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="leading-tight text-muted-foreground">{doctor.languages.join(', ')}</span>
            </div>
          </div>

          {/* Availability chip (fee lives on the Book CTA) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-medical px-3 py-1.5 text-[11px] font-semibold text-medical-foreground">
              <Clock className="h-3 w-3" />
              Next: {doctor.nextSlotDay}, {doctor.nextSlotTime}
            </span>
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap gap-1.5">
            {doctor.openNow === true && (
              <Badge variant="secondary" className="rounded-full text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Open Now
              </Badge>
            )}
            {doctor.openNow === false && (
              <Badge variant="secondary" className="rounded-full text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Closed
              </Badge>
            )}
            {doctor.availableToday && (
              <Badge variant="secondary" className="rounded-full text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <CalendarIcon className="h-3 w-3" /> Available Today
              </Badge>
            )}
            {doctor.videoConsult && (
              <Badge variant="secondary" className="rounded-full text-[10px] bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">
                <Video className="h-3 w-3" /> Video Consult
              </Badge>
            )}
            {doctor.onlineNow && (
              <Badge variant="secondary" className="rounded-full text-[10px] bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online Now
              </Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-auto grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button
              onClick={onBook}
              size="sm"
              className="h-10 rounded-full bg-medical text-medical-foreground shadow-md shadow-medical/25 hover:bg-medical/90"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Book · ₹{doctor.fee}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!doctor.videoConsult}
              className={cn(
                'h-10 rounded-full border-medical/30 hover:bg-medical-soft hover:text-medical dark:border-medical/40 dark:bg-transparent dark:hover:bg-medical-soft/70 dark:hover:text-medical',
                !doctor.videoConsult && 'opacity-40'
              )}
            >
              <Video className="h-3.5 w-3.5" />
              Video
            </Button>
            {doctor.phone ? (
              <Button size="sm" variant="outline" asChild className="h-10 rounded-full border-medical/30 hover:bg-medical-soft hover:text-medical dark:border-medical/40 dark:bg-transparent dark:hover:bg-medical-soft/70 dark:hover:text-medical">
                <a href={`tel:${doctor.phone}`}>
                  <Phone className="h-3.5 w-3.5" />
                  Call
                </a>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled className="h-10 rounded-full opacity-40">
                <Phone className="h-3.5 w-3.5" />
                Call
              </Button>
            )}
            {doctor.mapsUrl && (
              <Button size="sm" variant="outline" asChild className="h-10 rounded-full border-medical/30 hover:bg-medical-soft hover:text-medical dark:border-medical/40 dark:bg-transparent dark:hover:bg-medical-soft/70 dark:hover:text-medical">
                <a href={doctor.mapsUrl} target="_blank" rel="noopener noreferrer">
                  <Navigation className="h-3.5 w-3.5" />
                  Directions
                </a>
              </Button>
            )}
          </div>

          {/* Google Maps link footer */}
          {doctor.mapsUrl && (
            <a
              href={doctor.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-medical"
            >
              <Globe className="h-3 w-3" />
              View on Google Maps
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
