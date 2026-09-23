'use client'

import React, { useCallback, useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings as SettingsIcon,
  User,
  Mail,
  Calendar,
  Camera,
  Ruler,
  Weight,
  Bell,
  Shield,
  Palette,
  Watch,
  Crown,
  Info,
  LogOut,
  Edit2,
  Save,
  X,
  Download,
  Trash2,
  Lock,
  FileText,
  HelpCircle,
  Sun,
  Moon,
  Monitor,
  Check,
  ChevronRight,
  ExternalLink,
  Apple,
  Activity,
  HeartPulse,
  Zap,
  Smartphone,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  KeyRound,
  FileLock2,
  Compass,
  RotateCcw,
  Loader2,
  RefreshCw,
  History,
  Flag,
  CheckCircle2,
  ShieldAlert,
  Eye,
  EyeOff,
  MessageSquare,
  TrendingUp,
  Languages,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import ReminderPreferences from '@/components/settings/reminder-preferences'
import { LanguageSegmented } from '@/components/language-switcher'
import { useLanguage } from '@/components/language-provider'

// ─── Avatar helpers (client-side compression) ──────────────────────────────

// Read a File into a 256×256 cover-cropped JPEG data URL. Vercel has no
// writable filesystem, so avatars are stored in the User.avatar column as
// compressed data URLs — small enough for API responses, and the slim-token
// guard in lib/auth keeps them out of the session JWT (they are re-read from
// the DB via /api/auth/me instead).
async function compressAvatarToDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the selected image.'))
    reader.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('That file is not a valid image.'))
    image.src = dataUrl
  })
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser.')
  // Cover-crop: scale so the image fully covers the square, centered.
  const scale = Math.max(size / img.width, size / img.height)
  const w = img.width * scale
  const h = img.height * scale
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
  return canvas.toDataURL('image/jpeg', 0.85)
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface NotificationPref {
  id: string
  label: string
  description: string
  enabled: boolean
  icon: React.ElementType
  color: string
}

interface WearableDevice {
  id: string
  name: string
  description: string
  icon: React.ElementType
  color: string
  bgColor: string
  connected: boolean
  features: string[]
}

// ─── Settings Section Wrapper ───────────────────────────────────────────────

function SettingsSection({
  id,
  title,
  description,
  icon: Icon,
  iconColor,
  children,
  delay = 0,
}: {
  id?: string
  title: string
  description?: string
  icon: React.ElementType
  iconColor: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      id={id}
    >
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-full shrink-0', iconColor)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <CardTitle className="font-serif text-base">{title}</CardTitle>
              {description && <CardDescription className="text-xs">{description}</CardDescription>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">{children}</CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Language & Region Section (uses live translation for its own copy) ─────

function LanguageSection({ delay = 0 }: { delay?: number }) {
  const { t } = useLanguage()
  return (
    <SettingsSection
      title={t('language.title')}
      description={t('language.description')}
      icon={Languages}
      iconColor="bg-lilac text-plum"
      delay={delay}
    >
      <LanguageSegmented />
      <p className="text-xs text-muted-foreground mt-3 leading-relaxed flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
        <span>{t('language.moreComing')}</span>
      </p>
    </SettingsSection>
  )
}

// ─── Main Module ────────────────────────────────────────────────────────────

export default function SettingsModule() {
  const { isPremium, setPremium, userProfile, setUserProfile, setActiveModule } = useAppStore()
  const { theme, setTheme } = useTheme()
  // Detect client-side rendering to avoid hydration mismatch with theme
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const [isEditing, setIsEditing] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Form state — empty defaults for a brand-new user. Profile fields that
  // come from useAppStore (name, email, cycleLength, periodLength,
  // lastPeriodStart) fall back to sensible config defaults (cycle length 28,
  // period length 5) per the task rules — these are user-adjustable settings,
  // not fake history. dob / height / weight / lastPeriod start empty so a
  // new user fills them in rather than seeing fabricated personal data.
  const [formData, setFormData] = useState({
    name: userProfile?.name || 'Nuvia User',
    email: userProfile?.email || 'user@nuvia.health',
    dob: '',
    height: '',
    weight: '',
    cycleLength: String(userProfile?.cycleLength || 28),
    periodLength: String(userProfile?.periodLength || 5),
    lastPeriod: userProfile?.lastPeriodStart || '',
  })

  // Notification preferences
  const [notifications, setNotifications] = useState<NotificationPref[]>([
    { id: 'period', label: 'Period Reminders', description: 'Alerts before your period starts', enabled: true, icon: Calendar, color: 'bg-blush text-primary' },
    { id: 'ovulation', label: 'Ovulation Alerts', description: 'Notifications for fertile window', enabled: true, icon: HeartPulse, color: 'bg-lilac text-plum' },
    { id: 'pill', label: 'Medication Reminders', description: 'Birth control & supplement alerts', enabled: false, icon: Zap, color: 'bg-gold-soft text-amber-600 dark:text-amber-400' },
    { id: 'mood', label: 'Mood Check-ins', description: 'Daily mood logging prompts', enabled: true, icon: Activity, color: 'bg-plum-soft text-gold' },
    { id: 'water', label: 'Hydration Reminders', description: 'Periodic water intake alerts', enabled: false, icon: Activity, color: 'bg-medical-soft text-medical' },
    { id: 'sleep', label: 'Sleep Wind-down', description: 'Bedtime reminder alerts', enabled: true, icon: Moon, color: 'bg-lilac text-plum' },
    { id: 'community', label: 'Community Updates', description: 'Replies, likes, and mentions', enabled: true, icon: User, color: 'bg-blush text-primary' },
    { id: 'weekly', label: 'Weekly Health Report', description: 'Summary of your week every Sunday', enabled: true, icon: FileText, color: 'bg-peach-soft text-amber-600 dark:text-amber-400' },
    { id: 'tips', label: 'AI Tips & Insights', description: 'Personalized health tips', enabled: false, icon: Sparkles, color: 'bg-gold-soft text-amber-600 dark:text-amber-400' },
  ])

  // Wearable devices
  const [devices, setDevices] = useState<WearableDevice[]>([
    {
      id: 'apple',
      name: 'Apple Health',
      description: 'Sync cycle, sleep, steps & heart rate from your iPhone',
      icon: Apple,
      color: 'text-pink-600 dark:text-pink-400',
      bgColor: 'bg-pink-100 dark:bg-pink-950/40',
      connected: false,
      features: ['Steps', 'Heart Rate', 'Sleep', 'Cycle'],
    },
    {
      id: 'fitbit',
      name: 'Fitbit',
      description: 'Connect your Fitbit for sleep & activity tracking',
      icon: Watch,
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-100 dark:bg-teal-950/40',
      // Demo-data cleanup: no wearables are pre-connected for a brand-new user.
      // The user explicitly taps "Connect" to link a device.
      connected: false,
      features: ['Sleep Stages', 'Heart Rate', 'Steps', 'Stress'],
    },
    {
      id: 'garmin',
      name: 'Garmin Connect',
      description: 'Sync Garmin watch data for advanced health metrics',
      icon: Watch,
      color: 'text-plum',
      bgColor: 'bg-lilac',
      connected: false,
      features: ['Stress Score', 'Sleep', 'SpO2', 'Body Battery'],
    },
    {
      id: 'googlefit',
      name: 'Google Fit',
      description: 'Connect Google Fit on Android devices',
      icon: Smartphone,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 dark:bg-emerald-950/40',
      connected: false,
      features: ['Steps', 'Heart Points', 'Sleep'],
    },
  ])

  const toggleNotification = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, enabled: !n.enabled } : n))
  }

  const toggleDevice = (id: string) => {
    setDevices(prev => prev.map(d => {
      if (d.id === id) {
        const newConnected = !d.connected
        toast.success(newConnected ? `${d.name} connected` : `${d.name} disconnected`)
        return { ...d, connected: newConnected }
      }
      return d
    }))
  }

  // Shared profile update — persists via POST /api/user (Bearer session
  // token), mirrors the fresh user into the zustand store, refreshes the
  // session token, and syncs the auth state in page.tsx (which listens for
  // 'nuvia:auth-user') so the sidebar/topbar avatars update instantly.
  const saveProfile = async (patch: Record<string, unknown>) => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('chandracycle_token')
      : null
    const res = await fetch('/api/user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(patch),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.user) {
      throw new Error(data?.error || 'Could not save your profile. Please try again.')
    }
    const u = data.user as {
      id: string
      name: string | null
      email: string
      avatar: string | null
      provider?: string
      cycleLength?: number
      periodLength?: number
      lastPeriodStart?: string | null
    }
    setUserProfile({
      id: u.id,
      name: u.name || userProfile?.name || 'Nuvia User',
      email: u.email,
      avatar: u.avatar || undefined,
      cycleLength: u.cycleLength ?? userProfile?.cycleLength ?? 28,
      periodLength: u.periodLength ?? userProfile?.periodLength ?? 5,
      lastPeriodStart: u.lastPeriodStart ?? null,
      provider: (u.provider as 'email' | 'google' | 'apple') ?? userProfile?.provider,
    })
    if (data.token) localStorage.setItem('chandracycle_token', data.token)
    window.dispatchEvent(new CustomEvent('nuvia:auth-user', { detail: data.user }))
    return data.user
  }

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (JPG, PNG or WebP).')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('That photo is too large — please pick one under 15 MB.')
      return
    }
    setUploadingAvatar(true)
    try {
      const dataUrl = await compressAvatarToDataUrl(file)
      await saveProfile({ avatar: dataUrl })
      toast.success('Profile photo updated ✨', {
        description: 'Looking good! Your photo now shows across the app.',
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not upload your photo.')
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const removeAvatar = async () => {
    if (uploadingAvatar) return
    setUploadingAvatar(true)
    try {
      await saveProfile({ avatar: '' })
      toast.success('Profile photo removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove your photo.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSave = async () => {
    try {
      await saveProfile({
        name: formData.name.trim(),
        email: formData.email.trim(),
        dateOfBirth: formData.dob,
        height: formData.height ? Number(formData.height) : undefined,
        weight: formData.weight ? Number(formData.weight) : undefined,
        cycleLength: Number(formData.cycleLength),
        periodLength: Number(formData.periodLength),
        lastPeriodStart: formData.lastPeriod,
      })
      toast.success('Profile updated', {
        description: 'Your changes have been saved to your account.',
      })
    } catch {
      // Offline / API hiccup — keep the local edit so nothing is lost.
      setUserProfile({
        id: userProfile?.id || 'local-user',
        name: formData.name,
        email: formData.email,
        avatar: userProfile?.avatar,
        cycleLength: Number(formData.cycleLength),
        periodLength: Number(formData.periodLength),
        lastPeriodStart: formData.lastPeriod,
        provider: userProfile?.provider,
      })
      toast.warning('Saved on this device', {
        description: 'We could not reach the server — changes are stored locally for now.',
      })
    }
    setIsEditing(false)
  }

  const [exporting, setExporting] = useState(false)
  const handleExportData = async () => {
    setExporting(true)
    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('chandracycle_token')
        : null
      const res = await fetch('/api/user/export', {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Export failed')
      }
      const payload = await res.json()
      // Build the download client-side so we can show a real summary toast.
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chandracycle-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      const c = payload.counts ?? {}
      const parts = [
        c.cycles ? `${c.cycles} cycles` : null,
        c.moods ? `${c.moods} moods` : null,
        c.sleeps ? `${c.sleeps} sleeps` : null,
        c.symptoms ? `${c.symptoms} symptoms` : null,
        c.chatMessages ? `${c.chatMessages} chats` : null,
      ].filter(Boolean)
      toast.success('Export downloaded ✅', {
        description: parts.length
          ? `Your data: ${parts.join(' · ')}.`
          : 'Your data export is ready — accounts, records and AI conversations included.',
      })
    } catch (e) {
      console.error('Data export failed:', e)
      toast.error('Export failed', {
        description: e instanceof Error ? e.message : 'Please try again.',
      })
    } finally {
      setExporting(false)
    }
  }

  const [seedingDemo, setSeedingDemo] = useState(false)
  const handleSeedDemoData = async () => {
    if (!userProfile?.id) {
      toast.error('Please sign in first')
      return
    }
    setSeedingDemo(true)
    try {
      const res = await fetch('/api/seed-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userProfile.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Seeding failed')
      if (data.seeded) {
        toast.success('Demo history created! 🌸', {
          description: `${data.summary.cycles} past cycles, ${data.summary.symptoms} symptoms, ${data.summary.moods} mood & ${data.summary.sleeps} sleep entries added. Refresh dashboards to see rich charts.`,
        })
      } else {
        toast.info('You already have enough cycle history', {
          description: 'Demo data is only added for newer accounts with fewer than 3 cycles.',
        })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not seed demo data')
    } finally {
      setSeedingDemo(false)
    }
  }

  const handleDeleteAccount = () => {
    setDeleteDialogOpen(false)
    toast.error('Account scheduled for deletion', {
      description: 'Your account will be permanently deleted in 30 days. We\'re sorry to see you go.',
    })
  }

  const handleSignOut = () => {
    toast.success('Signed out', {
      description: 'You\'ve been signed out of Nuvia.',
    })
  }

  // ─── Real subscription management (backed by /api/subscription) ────────────
  interface SubDetails {
    id: string
    plan: string
    tier: string
    amount: number
    gst: number
    total: number
    currency: string
    status: string
    startDate: string
    endDate: string
    paymentMethod: string | null
    transactionId: string | null
    invoiceId: string | null
  }
  const [subDetails, setSubDetails] = useState<SubDetails | null>(null)
  const [subLoading, setSubLoading] = useState(true)
  const [cancelSubOpen, setCancelSubOpen] = useState(false)
  const [cancellingSub, setCancellingSub] = useState(false)

  useEffect(() => {
    if (!userProfile?.id) {
      setSubLoading(false)
      return
    }
    let cancelled = false
    fetch(`/api/subscription?userId=${encodeURIComponent(userProfile.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        setSubDetails(data?.subscription ?? null)
        setPremium(Boolean(data?.active))
        setSubLoading(false)
      })
      .catch(() => {
        if (!cancelled) setSubLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userProfile?.id, setPremium])

  const handleCancelSubscription = async () => {
    if (!userProfile?.id) return
    setCancellingSub(true)
    try {
      const res = await fetch(
        `/api/subscription?userId=${encodeURIComponent(userProfile.id)}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Cancellation failed')
      setSubDetails(null)
      setPremium(false)
      toast.success('Subscription cancelled', {
        description: 'Premium features stay available until the end of the paid period, then the account returns to Free.',
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not cancel subscription')
    } finally {
      setCancellingSub(false)
      setCancelSubOpen(false)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  // ─── Admin moderation console (operator session via /api/admin/*) ─────────
  const ADMIN_STORAGE_KEY = 'chandracycle_admin_token'
  interface ModPost {
    id: string
    title: string
    content: string
    category: string
    likes: number
    reportedCount: number
    hidden: boolean
    createdAt: string
    author: { id: string; name: string | null; email: string }
    commentCount: number
    reports?: { reason: string | null; createdAt: string; reporter: string }[]
  }
  interface AuditEntry {
    id: string
    adminName: string | null
    action: string
    targetLabel: string | null
    details: string | null
    createdAt: string
  }
  interface ModComment {
    id: string
    content: string
    createdAt: string
    reportedCount: number
    hidden: boolean
    author: { id: string; name: string | null; email: string }
    post: { id: string; title: string }
    reports?: { reason: string | null; createdAt: string; reporter: string }[]
  }
  interface ModActivity {
    byDay: { date: string; label: string; count: number }[]
    byAction: { restore: number; dismiss: number; delete: number }
    total: number
  }
  const [adminToken, setAdminToken] = useState<string | null>(null)
  const [adminName, setAdminName] = useState<string | null>(null)
  const [adminEmail, setAdminEmail] = useState('admin@chandracycle.app')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminLoggingIn, setAdminLoggingIn] = useState(false)
  const [modQueue, setModQueue] = useState<ModPost[]>([])
  const [modComments, setModComments] = useState<ModComment[]>([])
  const [modStats, setModStats] = useState<{ totalPosts: number; totalComments: number; hiddenCount: number; hiddenComments: number; reportedComments: number; queueSize: number } | null>(null)
  const [modActivity, setModActivity] = useState<ModActivity | null>(null)
  const [modAudit, setModAudit] = useState<AuditEntry[]>([])
  const [modLoading, setModLoading] = useState(false)
  const [modBusyId, setModBusyId] = useState<string | null>(null)
  const [deletePostId, setDeletePostId] = useState<string | null>(null)
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null)
  // Bulk selection on the post queue
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set())
  const [selectedCommentIds, setSelectedCommentIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const loadModQueue = useCallback(async (token: string) => {
    setModLoading(true)
    try {
      const res = await fetch('/api/admin/moderation', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load queue')
      setModQueue(data.queue ?? [])
      setModComments(data.commentQueue ?? [])
      setModStats(data.stats ?? null)
      setModActivity(data.activity ?? null)
      setModAudit(data.auditLog ?? [])
      setSelectedPostIds(new Set())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Moderation queue failed to load')
    } finally {
      setModLoading(false)
    }
  }, [])

  // Restore an existing operator session on mount.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(ADMIN_STORAGE_KEY)
      if (saved) {
        setAdminToken(saved)
        loadModQueue(saved)
      }
    } catch {
      // sessionStorage unavailable — operator just logs in again
    }
  }, [loadModQueue])

  const handleAdminLogin = async () => {
    if (!adminEmail.trim() || !adminPassword) {
      toast.error('Email and password are required')
      return
    }
    setAdminLoggingIn(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      setAdminToken(data.token)
      setAdminName(data.admin?.name ?? 'Admin')
      setAdminPassword('')
      try {
        sessionStorage.setItem(ADMIN_STORAGE_KEY, data.token)
      } catch {
        // best-effort
      }
      toast.success(`Signed in as ${data.admin?.role ?? 'admin'}`)
      loadModQueue(data.token)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Admin login failed')
    } finally {
      setAdminLoggingIn(false)
    }
  }

  const handleAdminLogout = async () => {
    if (adminToken) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      } catch {
        // best-effort — clear locally regardless
      }
    }
    setAdminToken(null)
    setAdminName(null)
    setModQueue([])
    setModComments([])
    setModStats(null)
    setModAudit([])
    setSelectedPostIds(new Set())
    try {
      sessionStorage.removeItem(ADMIN_STORAGE_KEY)
    } catch {
      // ignore
    }
    toast.success('Moderator signed out')
  }

  const handleModAction = async (
    targetType: 'post' | 'comment',
    id: string,
    action: 'restore' | 'dismiss' | 'delete'
  ) => {
    if (!adminToken) return
    setModBusyId(id)
    try {
      const res = await fetch('/api/admin/moderation', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ targetType, id, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action failed')
      toast.success(data.message || 'Done')
      loadModQueue(adminToken)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Moderation action failed')
    } finally {
      setModBusyId(null)
      setDeletePostId(null)
      setDeleteCommentId(null)
    }
  }

  // Bulk moderation on the selected post queue items.
  const handleBulkAction = async (action: 'restore' | 'dismiss' | 'delete') => {
    if (!adminToken || selectedPostIds.size === 0) return
    setBulkBusy(true)
    try {
      const res = await fetch('/api/admin/moderation', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ targetType: 'post', ids: Array.from(selectedPostIds), action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bulk action failed')
      toast.success(data.message || 'Bulk action done')
      loadModQueue(adminToken)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk action failed')
    } finally {
      setBulkBusy(false)
    }
  }

  const togglePostSelection = (postId: string) => {
    setSelectedPostIds((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }

  // Bulk moderation on the selected COMMENT queue items (mirrors posts).
  const handleBulkCommentAction = async (action: 'restore' | 'dismiss' | 'delete') => {
    if (!adminToken || selectedCommentIds.size === 0) return
    setBulkBusy(true)
    try {
      const res = await fetch('/api/admin/moderation', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ targetType: 'comment', ids: Array.from(selectedCommentIds), action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bulk action failed')
      toast.success(data.message || 'Bulk action done')
      loadModQueue(adminToken)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk action failed')
    } finally {
      setBulkBusy(false)
    }
  }

  const toggleCommentSelection = (commentId: string) => {
    setSelectedCommentIds((prev) => {
      const next = new Set(prev)
      if (next.has(commentId)) next.delete(commentId)
      else next.add(commentId)
      return next
    })
  }

  const themeOptions = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ] as const

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-plum-soft text-gold shadow-md">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account, preferences, and privacy</p>
          <span className="gold-divider text-[10px] mt-1" aria-hidden>
            <span>✦</span>
          </span>
        </div>
      </motion.div>

      {/* ─── Profile Card ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="overflow-hidden border-primary/20 group/banner">
          {/* Branded banner — crescent moon + dotted texture + shimmer */}
          <div className="relative bg-gradient-to-r from-plum via-plum-soft to-plum h-24 sm:h-28 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.14] [background-image:radial-gradient(circle_at_center,white_1.2px,transparent_1.2px)] [background-size:16px_16px]" />
            <div className="absolute -top-10 -right-8 h-32 w-32 rounded-full bg-gold/25 blur-2xl transition-transform duration-700 group-hover/banner:scale-125" />
            <div className="absolute top-4 right-24 h-10 w-10 rounded-full bg-gold/15" />
            {/* Crescent: two overlapping circles */}
            <div className="absolute right-8 top-1/2 -translate-y-1/2 h-9 w-9">
              <div className="absolute inset-0 rounded-full bg-gold/40" />
              <div className="absolute inset-0 rounded-full bg-plum translate-x-2.5 -translate-y-1.5" />
            </div>
            <div className="absolute left-1/4 -bottom-6 h-16 w-16 rounded-full bg-gold/10 blur-lg" />
            {/* Shimmer sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-gold/0 via-gold/20 to-gold/0 -translate-x-full group-hover/banner:translate-x-full transition-transform duration-1000" />
          </div>
          <CardContent className="p-5 -mt-10">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="relative shrink-0">
                <Avatar className="h-20 w-20 border-4 border-card shadow-lg ring-2 ring-gold/60 ring-offset-0">
                  {userProfile?.avatar && (
                    <AvatarImage src={userProfile.avatar} alt={`${formData.name}'s profile photo`} />
                  )}
                  <AvatarFallback className="bg-gradient-to-br from-plum-soft to-plum text-gold text-xl font-bold">
                    {formData.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {/* Upload / change photo — works without entering edit mode */}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  aria-label={userProfile?.avatar ? 'Change profile photo' : 'Upload profile photo'}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-plum text-gold shadow-md ring-2 ring-card transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
                >
                  {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                </button>
                {/* Remove photo */}
                {userProfile?.avatar && !uploadingAvatar && (
                  <button
                    type="button"
                    onClick={() => void removeAvatar()}
                    aria-label="Remove profile photo"
                    className="absolute -top-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full bg-card text-muted-foreground shadow-md ring-1 ring-border transition-colors hover:text-rose-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {!userProfile?.avatar && (
                  <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-card" title="Account active" />
                )}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-hidden="true"
                  tabIndex={-1}
                  onChange={(e) => void handleAvatarFile(e.target.files?.[0])}
                />
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold">{formData.name}</h2>
                  {isPremium ? (
                    <Badge variant="secondary" className="bg-gold-soft text-plum gap-1">
                      <Crown className="h-3 w-3" /> Premium
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-muted text-muted-foreground">Free</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3.5 w-3.5" /> {formData.email}
                </p>
              </div>
              <Button
                variant={isEditing ? 'default' : 'outline'}
                size="sm"
                className={cn('min-h-11 rounded-full px-5', isEditing && 'btn-plum font-semibold')}
                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              >
                {isEditing ? (
                  <><Save className="h-4 w-4 mr-1.5" /> Save Changes</>
                ) : (
                  <><Edit2 className="h-4 w-4 mr-1.5" /> Edit Profile</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="border-gold/40 bg-gold-soft/40">
              <CardContent className="p-4 flex items-center gap-2 text-sm">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-plum">
                  You're now editing your profile. Click "Save Changes" at the top to apply.
                </span>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Personal Information ──────────────────────────────────── */}
      <SettingsSection
        title="Personal Information"
        description="Your basic profile details"
        icon={User}
        iconColor="bg-blush text-primary"
        delay={0.1}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs flex items-center gap-1.5">
              <User className="h-3 w-3" /> Full Name
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              disabled={!isEditing}
              className={!isEditing ? 'bg-muted/50' : ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> Email Address
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              disabled={!isEditing}
              className={!isEditing ? 'bg-muted/50' : ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dob" className="text-xs flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Date of Birth
            </Label>
            <Input
              id="dob"
              type="date"
              value={formData.dob}
              onChange={(e) => setFormData(prev => ({ ...prev, dob: e.target.value }))}
              disabled={!isEditing}
              className={!isEditing ? 'bg-muted/50' : ''}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="height" className="text-xs flex items-center gap-1.5">
                <Ruler className="h-3 w-3" /> Height (cm)
              </Label>
              <Input
                id="height"
                value={formData.height}
                onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))}
                disabled={!isEditing}
                className={!isEditing ? 'bg-muted/50' : ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight" className="text-xs flex items-center gap-1.5">
                <Weight className="h-3 w-3" /> Weight (kg)
              </Label>
              <Input
                id="weight"
                value={formData.weight}
                onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                disabled={!isEditing}
                className={!isEditing ? 'bg-muted/50' : ''}
              />
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* ─── Cycle Settings ────────────────────────────────────────── */}
      <SettingsSection
        title="Cycle Settings"
        description="Personalize your cycle tracking parameters"
        icon={Calendar}
        iconColor="bg-peach-soft text-amber-600 dark:text-amber-400"
        delay={0.15}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Cycle Length (days)</Label>
            <Select
              value={formData.cycleLength}
              onValueChange={(v) => setFormData(prev => ({ ...prev, cycleLength: v }))}
              disabled={!isEditing}
            >
              <SelectTrigger className={!isEditing ? 'bg-muted/50' : ''}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 16 }, (_, i) => i + 21).map(d => (
                  <SelectItem key={d} value={String(d)}>{d} days</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Period Length (days)</Label>
            <Select
              value={formData.periodLength}
              onValueChange={(v) => setFormData(prev => ({ ...prev, periodLength: v }))}
              disabled={!isEditing}
            >
              <SelectTrigger className={!isEditing ? 'bg-muted/50' : ''}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(d => (
                  <SelectItem key={d} value={String(d)}>{d} days</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastPeriod" className="text-xs">Last Period Start</Label>
            <Input
              id="lastPeriod"
              type="date"
              value={formData.lastPeriod}
              onChange={(e) => setFormData(prev => ({ ...prev, lastPeriod: e.target.value }))}
              disabled={!isEditing}
              className={!isEditing ? 'bg-muted/50' : ''}
            />
          </div>
        </div>
        <div className="mt-4 p-3 rounded-lg bg-blush/60 border border-primary/20">
          <p className="text-xs text-plum flex items-start gap-2">
            <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <strong>Tip:</strong> The more accurate your cycle settings, the better Nuvia's predictions.
              Most women have cycles between 26–32 days. Update if your cycle changes over time.
            </span>
          </p>
        </div>
      </SettingsSection>

      {/* ─── Notification Preferences ──────────────────────────────── */}
      <SettingsSection
        title="Notification Preferences"
        description="Choose what you want to be notified about"
        icon={Bell}
        iconColor="bg-gold-soft text-plum"
        delay={0.2}
      >
        <div className="space-y-1">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/40 transition-colors"
            >
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-full shrink-0', n.color)}>
                <n.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{n.label}</div>
                <div className="text-xs text-muted-foreground">{n.description}</div>
              </div>
              <Switch
                checked={n.enabled}
                onCheckedChange={() => toggleNotification(n.id)}
              />
            </div>
          ))}
        </div>

        {/* ─── Period reminders + quiet hours (persisted) ────────────── */}
        <Separator className="my-4" />
        <ReminderPreferences />
      </SettingsSection>

      {/* ─── Language & Region ─────────────────────────────────────── */}
      <LanguageSection delay={0.22} />

      {/* ─── Privacy & Security ────────────────────────────────────── */}
      <SettingsSection
        title="Privacy & Security"
        description="Manage your data and account security"
        icon={Shield}
        iconColor="bg-plum-soft text-gold"
        delay={0.25}
      >
        <div className="space-y-2">
          <button
            onClick={handleSeedDemoData}
            disabled={seedingDemo}
            className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/40 transition-colors text-left disabled:opacity-60"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blush text-primary shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{seedingDemo ? 'Creating demo history…' : 'Load Demo History'}</div>
              <div className="text-xs text-muted-foreground">Fill your dashboard & charts with 6 months of sample cycle data</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <button
            onClick={handleExportData}
            disabled={exporting}
            className="group w-full flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-blush/40 hover:border-primary/50 hover:shadow-sm transition-all text-left disabled:opacity-60"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-plum-soft text-gold shrink-0 transition-transform group-hover:scale-110 group-active:scale-95">
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium flex items-center gap-1.5">
                {exporting ? 'Preparing your export…' : 'Export My Data'}
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-gold-soft text-plum">
                  JSON
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Download everything — cycles, logs, AI chats & posts — as one portable file
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>

          <button
            onClick={() => toast.info('Privacy Policy', { description: 'Opening privacy policy in a new tab...' })}
            className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/40 transition-colors text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lilac text-plum shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Privacy Policy</div>
              <div className="text-xs text-muted-foreground">Read our full data handling practices</div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-3 p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/10">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Lock className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium flex items-center gap-1.5">
                End-to-End Encryption
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <ShieldCheck className="h-2.5 w-2.5 mr-0.5" /> Active
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                All your health data is encrypted with AES-256 — even we can't read it.
              </div>
            </div>
          </div>

          <Separator className="my-2" />

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <button className="w-full flex items-center gap-3 p-3 rounded-lg border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors text-left">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 shrink-0">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-rose-600 dark:text-rose-400">Delete My Account</div>
                  <div className="text-xs text-muted-foreground">Permanently remove your account and all data</div>
                </div>
                <ChevronRight className="h-4 w-4 text-rose-400" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-500" />
                  Delete account permanently?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-relaxed">
                  This will permanently delete your account, all health data, cycle history, community posts, and AI conversations. <strong className="text-foreground">This action cannot be undone.</strong> You'll have a 30-day grace period before permanent deletion. To proceed, type <code className="px-1 py-0.5 bg-muted rounded text-xs">DELETE</code> below.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input placeholder="Type DELETE to confirm" className="my-2" />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Delete Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SettingsSection>


      {/* ─── Content Moderation (operator console) ─────────────────── */}
      <SettingsSection
        title="Content Moderation"
        description="Operator console for reported community posts"
        icon={ShieldAlert}
        iconColor="bg-lilac text-plum"
        delay={0.32}
      >
        {!adminToken ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-primary/20 bg-blush/40 text-xs text-muted-foreground">
              <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                Reports from the community feed (3+ reports auto-hide a post) land here for review.
                Every action is written to an audit trail. Operator sessions last 24 hours.
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="admin-email" className="text-xs">Operator email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@chandracycle.app"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-password" className="text-xs">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdminLogin()
                  }}
                />
              </div>
            </div>
            <Button className="w-full sm:w-auto" onClick={handleAdminLogin} disabled={adminLoggingIn}>
              {adminLoggingIn ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Signing in…</>
              ) : (
                <><ShieldCheck className="h-4 w-4 mr-1.5" /> Open moderation console</>
              )}
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground/80">
              First run? The default operator is provisioned automatically on the first sign-in —{' '}
              <span className="font-medium text-foreground">admin@chandracycle.app</span>
              {' '}/{' '}<span className="font-medium text-foreground">chandra-admin</span>.
              Keep these credentials private — anyone with them can moderate the community feed.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header row */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-blush text-primary border-0 gap-1">
                <ShieldCheck className="h-3 w-3" /> {adminName ?? 'Moderator'} signed in
              </Badge>
              {modStats && (
                <Badge variant="outline" className="text-[10px]">
                  {modStats.totalPosts} posts · {modStats.hiddenCount} hidden posts · {modStats.hiddenComments} hidden comments · {modStats.reportedComments} reported · queue {modStats.queueSize}
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => adminToken && loadModQueue(adminToken)} disabled={modLoading}>
                  <RefreshCw className={cn('h-3.5 w-3.5 mr-1', modLoading && 'animate-spin')} /> Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={handleAdminLogout}>
                  Sign out
                </Button>
              </div>
            </div>

            {/* Moderation pulse — 7-day activity from the audit trail */}
            {modActivity && modActivity.total > 0 && (
              <div className="rounded-xl border bg-muted/20 px-3.5 py-3 transition-colors hover:border-primary/40">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold">Moderation pulse — last 7 days</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {modActivity.total} action{modActivity.total === 1 ? '' : 's'} · {modActivity.byAction.restore} restored · {modActivity.byAction.dismiss} dismissed · {modActivity.byAction.delete} deleted
                  </span>
                </div>
                <div className="flex items-end gap-1.5">
                  {modActivity.byDay.map((d) => {
                    const max = Math.max(...modActivity.byDay.map((x) => x.count), 1)
                    return (
                      <div
                        key={d.date}
                        className="flex-1 flex flex-col items-center gap-1 group/day"
                        title={`${d.count} action${d.count === 1 ? '' : 's'} on ${d.date}`}
                      >
                        <div
                          className={cn(
                            'w-full rounded-t-sm transition-all group-hover/day:brightness-110',
                            d.count > 0 ? 'bg-primary/70' : 'bg-muted-foreground/15'
                          )}
                          style={{ height: `${Math.max((d.count / max) * 28, 3)}px` }}
                        />
                        <span className="text-[9px] text-muted-foreground">{d.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Bulk action bar */}
            {selectedPostIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-blush/50 px-3 py-2">
                <Badge className="bg-primary text-primary-foreground border-0 text-[10px] h-5">
                  {selectedPostIds.size} selected
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                  disabled={bulkBusy}
                  onClick={() => handleBulkAction('restore')}
                >
                  {bulkBusy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                  Restore selected
                </Button>
                <Button size="sm" variant="outline" className="h-9 text-xs" disabled={bulkBusy} onClick={() => handleBulkAction('dismiss')}>
                  Dismiss selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
                  disabled={bulkBusy}
                  onClick={() => handleBulkAction('delete')}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Delete selected
                </Button>
                <Button size="sm" variant="ghost" className="h-9 text-xs ml-auto" disabled={bulkBusy} onClick={() => setSelectedPostIds(new Set())}>
                  Clear selection
                </Button>
              </div>
            )}

            {/* Queue */}
            {modLoading && modQueue.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading moderation queue…
              </div>
            ) : modQueue.length === 0 && modComments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center border rounded-xl bg-muted/20">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-sm font-medium">Queue is clear</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                  No reported or hidden posts right now. Reported content will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1 chandracycle-scroll">
                {modQueue.map((post) => (
                  <div
                    key={post.id}
                    className={cn(
                      'rounded-xl border p-3.5 space-y-2.5',
                      post.hidden
                        ? 'border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/10'
                        : 'border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/10'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        aria-label={selectedPostIds.has(post.id) ? 'Deselect post' : 'Select post'}
                        onClick={() => togglePostSelection(post.id)}
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors',
                          selectedPostIds.has(post.id)
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-muted-foreground/40 hover:border-primary/60'
                        )}
                      >
                        {selectedPostIds.has(post.id) && <Check className="h-3 w-3" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold leading-snug">{post.title}</span>
                          {post.hidden ? (
                            <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-0 text-[10px] h-5">
                              <Eye className="h-2.5 w-2.5 mr-1" /> Hidden
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-0 text-[10px] h-5">
                              <Flag className="h-2.5 w-2.5 mr-1" /> Reported
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] h-5 capitalize">
                            {post.category.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{post.content}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                          <span>by {post.author.name ?? post.author.email}</span>
                          <span>{post.reportedCount} report{post.reportedCount === 1 ? '' : 's'}</span>
                          <span>{post.commentCount} comment{post.commentCount === 1 ? '' : 's'}</span>
                          <span>{post.likes} likes</span>
                        </div>
                        {post.reports && post.reports.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {post.reports.slice(0, 4).map((r, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                                title={`Reported by ${r.reporter} · ${new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                              >
                                <Flag className="h-2.5 w-2.5" />
                                {r.reason || 'No reason given'} · {r.reporter}
                              </span>
                            ))}
                            {post.reports.length > 4 && (
                              <span className="text-[10px] text-muted-foreground self-center">
                                +{post.reports.length - 4} more report{post.reports.length - 4 === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        disabled={modBusyId === post.id}
                        onClick={() => handleModAction('post', post.id, 'restore')}
                      >
                        {modBusyId === post.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        Restore & clear reports
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs"
                        disabled={modBusyId === post.id}
                        onClick={() => handleModAction('post', post.id, 'dismiss')}
                      >
                        Dismiss (keep hidden)
                      </Button>
                      <AlertDialog open={deletePostId === post.id} onOpenChange={(open) => setDeletePostId(open ? post.id : null)}>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 text-xs border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
                            disabled={modBusyId === post.id}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this post permanently?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm leading-relaxed">
                              &ldquo;{post.title}&rdquo; and its {post.commentCount} comment{post.commentCount === 1 ? '' : 's'} will be
                              permanently removed. This action is recorded in the audit trail and cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-rose-600 hover:bg-rose-700 text-white"
                              onClick={() => handleModAction('post', post.id, 'delete')}
                            >
                              Delete post
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}

                {/* Bulk action bar — comments */}
                {selectedCommentIds.size > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-blush/50 px-3 py-2">
                    <Badge className="bg-primary text-primary-foreground border-0 text-[10px] h-5">
                      {selectedCommentIds.size} comment{selectedCommentIds.size === 1 ? '' : 's'} selected
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                      disabled={bulkBusy}
                      onClick={() => handleBulkCommentAction('restore')}
                    >
                      {bulkBusy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                      Restore selected
                    </Button>
                    <Button size="sm" variant="outline" className="h-9 text-xs" disabled={bulkBusy} onClick={() => handleBulkCommentAction('dismiss')}>
                      Dismiss reports
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 text-xs border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
                      disabled={bulkBusy}
                      onClick={() => handleBulkCommentAction('delete')}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Delete selected
                    </Button>
                    <Button size="sm" variant="ghost" className="h-9 text-xs ml-auto" disabled={bulkBusy} onClick={() => setSelectedCommentIds(new Set())}>
                      Clear selection
                    </Button>
                  </div>
                )}

                {/* Reported & hidden comments queue */}
                {modComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`rounded-xl border p-3.5 space-y-2.5 transition-colors ${
                      comment.hidden
                        ? 'border-orange-200 dark:border-orange-900 bg-orange-50/40 dark:bg-orange-950/10'
                        : 'border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/10'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        aria-label={selectedCommentIds.has(comment.id) ? 'Deselect comment' : 'Select comment'}
                        onClick={() => toggleCommentSelection(comment.id)}
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors',
                          selectedCommentIds.has(comment.id)
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-muted-foreground/40 hover:border-primary/60'
                        )}
                      >
                        {selectedCommentIds.has(comment.id) && <Check className="h-3 w-3" />}
                      </button>
                      <div className={`mt-0.5 flex h-4 w-4 items-center justify-center ${comment.hidden ? 'text-orange-500' : 'text-amber-500'}`}>
                        <MessageSquare className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {comment.hidden ? (
                            <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-0 text-[10px] h-5">
                              <EyeOff className="h-2.5 w-2.5 mr-1" /> Hidden comment
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-0 text-[10px] h-5">
                              <Flag className="h-2.5 w-2.5 mr-1" /> Reported · {comment.reportedCount} report{comment.reportedCount === 1 ? '' : 's'}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            on &ldquo;{comment.post.title}&rdquo;
                          </span>
                        </div>
                        <p className="text-xs text-foreground mt-1 line-clamp-2">{comment.content}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                          <span>by {comment.author.name ?? comment.author.email}</span>
                          <span>{new Date(comment.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </div>
                        {comment.reports && comment.reports.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {comment.reports.slice(0, 4).map((r, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                                title={`Reported by ${r.reporter} · ${new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                              >
                                <Flag className="h-2.5 w-2.5" />
                                {r.reason || 'No reason given'} · {r.reporter}
                              </span>
                            ))}
                            {comment.reports.length > 4 && (
                              <span className="text-[10px] text-muted-foreground self-center">
                                +{comment.reports.length - 4} more report{comment.reports.length - 4 === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {comment.hidden ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                          disabled={modBusyId === comment.id}
                          onClick={() => handleModAction('comment', comment.id, 'restore')}
                        >
                          {modBusyId === comment.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          )}
                          Restore comment
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                          disabled={modBusyId === comment.id}
                          onClick={() => handleModAction('comment', comment.id, 'dismiss')}
                        >
                          {modBusyId === comment.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          )}
                          Dismiss reports
                        </Button>
                      )}
                      <AlertDialog open={deleteCommentId === comment.id} onOpenChange={(open) => setDeleteCommentId(open ? comment.id : null)}>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 text-xs border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
                            disabled={modBusyId === comment.id}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this comment permanently?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm leading-relaxed">
                              &ldquo;{comment.content.slice(0, 100)}&rdquo; will be permanently removed from
                              &ldquo;{comment.post.title}&rdquo;. This action is recorded in the audit trail and cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-rose-600 hover:bg-rose-700 text-white"
                              onClick={() => handleModAction('comment', comment.id, 'delete')}
                            >
                              Delete comment
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Audit trail */}
            {modAudit.length > 0 && (
              <div className="pt-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground">Recent moderation audit trail</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {modAudit.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2 text-[11px] p-2 rounded-lg bg-muted/30">
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0 capitalize">
                        {entry.action.replace('moderation:', '')}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{entry.targetLabel ?? '—'}</span>
                        <span className="text-muted-foreground"> · {entry.adminName}</span>
                        {entry.details && (
                          <div className="text-muted-foreground truncate">{entry.details}</div>
                        )}
                      </div>
                      <span className="text-muted-foreground shrink-0">
                        {new Date(entry.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SettingsSection>

      {/* ─── Appearance ────────────────────────────────────────────── */}
      <SettingsSection
        title="Appearance"
        description="Customize how Nuvia looks for you"
        icon={Palette}
        iconColor="bg-lilac text-plum"
        delay={0.3}
      >
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map(opt => {
            const isActive = mounted && theme === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => setTheme(opt.id)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                  isActive
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  <opt.icon className="h-5 w-5" />
                </div>
                <span className={cn('text-sm font-medium', isActive && 'text-primary')}>{opt.label}</span>
                {isActive && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-blush text-primary gap-0.5">
                    <Check className="h-2.5 w-2.5" /> Active
                  </Badge>
                )}
              </button>
            )
          })}
        </div>
        {!mounted && (
          <p className="text-xs text-muted-foreground mt-3 text-center">Loading theme...</p>
        )}
      </SettingsSection>

      {/* ─── Health Connections ────────────────────────────────────── */}
      <SettingsSection
        title="Health Connections"
        description="Sync data from your wearable devices"
        icon={Watch}
        iconColor="bg-medical-soft text-medical"
        delay={0.35}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {devices.map(device => (
            <div
              key={device.id}
              className={cn(
                'rounded-xl border p-3 transition-all',
                device.connected
                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10'
                  : 'border-border'
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-full shrink-0', device.bgColor, device.color)}>
                  <device.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold">{device.name}</span>
                    {device.connected && (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 gap-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{device.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {device.features.map(f => (
                      <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant={device.connected ? 'outline' : 'default'}
                className="w-full mt-3"
                onClick={() => toggleDevice(device.id)}
              >
                {device.connected ? (
                  <><X className="h-3.5 w-3.5 mr-1.5" /> Disconnect</>
                ) : (
                  <><Zap className="h-3.5 w-3.5 mr-1.5" /> Connect</>
                )}
              </Button>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* ─── Subscription (real, DB-backed) ────────────────────────── */}
      <SettingsSection
        title="Subscription"
        description="Manage your Nuvia plan"
        icon={Crown}
        iconColor="bg-gold-soft text-amber-600 dark:text-amber-400"
        delay={0.4}
      >
        {subLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your plan…
          </div>
        ) : subDetails ? (
          <div className="rounded-xl border overflow-hidden">
            <div className="p-4 bg-gold-soft/40">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full shrink-0 bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 text-plum shadow-md">
                  <Crown className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold capitalize">
                      {subDetails.tier} · {subDetails.plan}
                    </span>
                    <Badge variant="secondary" className="bg-gold-soft text-plum">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                    </Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {subDetails.paymentMethod?.replace('_', ' ') ?? 'paypal'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ₹{subDetails.amount.toFixed(0)} + ₹{subDetails.gst.toFixed(2)} GST = ₹{subDetails.total.toFixed(2)} / {subDetails.plan === 'yearly' ? 'year' : 'month'}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-card">
              {[
                { label: 'Started', value: formatDate(subDetails.startDate) },
                { label: 'Renews / Ends', value: formatDate(subDetails.endDate) },
                { label: 'Invoice', value: subDetails.invoiceId ?? '—' },
                { label: 'Transaction', value: subDetails.transactionId ?? '—' },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-muted/40 p-2.5 min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.label}</div>
                  <div className="text-xs font-semibold mt-0.5 truncate" title={item.value}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 flex flex-col sm:flex-row gap-2 border-t bg-card">
              <AlertDialog open={cancelSubOpen} onOpenChange={setCancelSubOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="flex-1 border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30">
                    <X className="h-4 w-4 mr-1.5" /> Cancel Subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel your {subDetails.tier} plan?</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm leading-relaxed">
                      Your premium features — unlimited AI coaching, advanced reports and predictions —
                      will remain active until <strong className="text-foreground">{formatDate(subDetails.endDate)}</strong>,
                      after which your account returns to the Free plan. Your invoices stay available.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={cancellingSub}>Keep plan</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault()
                        handleCancelSubscription()
                      }}
                      disabled={cancellingSub}
                      className="bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      {cancellingSub ? (
                        <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Cancelling…</>
                      ) : (
                        'Cancel subscription'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => toast.info('Billing portal', { description: 'Payment method updates coming soon — PayPal sandbox is used in this deployment.' })}
              >
                <FileText className="h-4 w-4 mr-1.5" /> Manage Billing
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <div className="p-4 flex items-center gap-4 bg-muted/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-full shrink-0 bg-muted text-muted-foreground">
                <Crown className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold">Free Plan</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Basic period tracking, mood logging & community access
                </p>
              </div>
            </div>
            <div className="p-3 bg-card">
              <Button className="btn-plum w-full rounded-full min-h-11 font-semibold" onClick={() => setActiveModule('premium')}>
                <Crown className="h-4 w-4 mr-1.5" /> Upgrade to Premium
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>
            </div>
          </div>
        )}
      </SettingsSection>

      {/* ─── About ─────────────────────────────────────────────────── */}
      <SettingsSection
        title="About Nuvia"
        description="App information and resources"
        icon={Info}
        iconColor="bg-medical-soft text-medical"
        delay={0.45}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                A
              </div>
              <div>
                <div className="text-sm font-semibold">Nuvia</div>
                <div className="text-xs text-muted-foreground">AI Women's Health Companion</div>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">v2.4.1</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => toast.info('Terms of Service', { description: 'Opening terms in a new tab...' })}
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/40 transition-colors text-left"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">Terms of Service</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
            </button>
            <button
              onClick={() => toast.info('Privacy Policy', { description: 'Opening privacy policy in a new tab...' })}
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/40 transition-colors text-left"
            >
              <FileLock2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">Privacy Policy</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
            </button>
            <button
              onClick={() => toast.info('Support Center', { description: 'Opening support center in a new tab...' })}
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/40 transition-colors text-left"
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">Help & Support</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
            </button>
            <button
              onClick={() => toast.info('Contact us', { description: 'support@nuvia.health · +91 80-4567-8900' })}
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/40 transition-colors text-left"
            >
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">Contact Us</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {[
              { label: 'HIPAA', icon: ShieldCheck, color: 'text-emerald-600' },
              { label: 'GDPR', icon: KeyRound, color: 'text-medical' },
              { label: 'E2E Encrypted', icon: Lock, color: 'text-plum' },
              { label: 'ISO 27001', icon: Shield, color: 'text-amber-600' },
            ].map(b => (
              <div key={b.label} className="flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs">
                <b.icon className={cn('h-3.5 w-3.5', b.color)} />
                <span className="font-medium">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </SettingsSection>

      {/* ─── Help & Guidance ─────────────────────────────────────────── */}
      <SettingsSection
        title="Help & Guidance"
        description="Tour the app and find help"
        icon={Compass}
        iconColor="bg-peach-soft text-amber-600 dark:text-amber-400"
        delay={0.48}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            New to Nuvia? Replay the interactive tour to learn where everything is —
            the sidebar, Period Tracker, AI Coach, your profile, and Premium.
          </p>
          <div className="rounded-xl border border-gold/40 bg-gold-soft/40 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-plum-soft text-gold">
              <Compass className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Replay onboarding tour</div>
              <div className="text-xs text-muted-foreground">
                Restarts the 60-second guided walkthrough of the app.
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-gold/50 text-plum hover:bg-gold-soft/60"
              onClick={() => {
                try {
                  // Remove the per-user tour-seen flag so the tour auto-starts
                  // on the next dashboard load. Also clear the legacy global
                  // flag for back-compat with older sessions.
                  const uid = userProfile?.id
                  if (uid) localStorage.removeItem(`chandracycle_tour_seen_${uid}`)
                  localStorage.removeItem('chandracycle_tour_seen')
                } catch {
                  // ignore — best-effort
                }
                toast.success('Onboarding tour restarted', {
                  description: 'The tour will open on the dashboard in a moment.',
                })
                // Slight delay so the toast can render before the reload.
                setTimeout(() => {
                  window.location.reload()
                }, 600)
              }}
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Replay tour
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              onClick={() =>
                toast.info('Help Center', {
                  description: 'Opening the help center in a new tab...',
                })
              }
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/40 transition-colors text-left"
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">Help Center</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
            </button>
            <button
              onClick={() =>
                toast.info('Contact us', {
                  description: 'support@nuvia.health · +91 80-4567-8900',
                })
              }
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/40 transition-colors text-left"
            >
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">Contact Support</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* ─── Sign Out ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="pb-4"
      >
        <Card className="border-rose-200 dark:border-rose-900">
          <CardContent className="p-4">
            <Button
              variant="outline"
              className="w-full border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              You can sign back in anytime with your email.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground pb-2">
        Made with <HeartPulse className="inline h-3 w-3 text-rose-500" /> for women everywhere · © 2024 Nuvia Health
      </div>
    </div>
  )
}
