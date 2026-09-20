'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import {
  Sparkles,
  HeartPulse,
  Brain,
  Baby,
  Flower2,
  ShieldCheck,
  Loader2,
  Mail,
  KeyRound,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  Check,
} from 'lucide-react'
import GoogleOAuthButton from './google-oauth-button'
import GoogleSetupDialog from './google-setup-dialog'
import { BrandMark, BrandWordmark, BrandTagline } from '@/components/brand/brand-logo'

type Mode = 'login' | 'signup'

export interface SessionUser {
  id: string
  name: string | null
  email: string
  avatar: string | null
  provider: string
  onboardingComplete: boolean
  cycleLength: number
  periodLength: number
  lastPeriodStart: string | null
}

interface AuthScreenProps {
  onAuthed: (user: SessionUser) => void
}

const features = [
  { icon: HeartPulse, title: 'Cycle & Hormone IQ', desc: 'AI-powered predictions for your unique rhythm' },
  { icon: Baby, title: 'Fertility & Pregnancy', desc: 'Track ovulation, conceive, and glow through every trimester' },
  { icon: Flower2, title: 'PCOS & Menopause Care', desc: 'Personalised plans for every life stage' },
  { icon: Brain, title: 'AI Health Coach', desc: '24/7 guidance tailored to your body' },
]

// Staggered entrance variants for premium feel
const containerStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
}
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
}

// Glass sphere blobs — pure CSS drift/float (prefers-reduced-motion covered
// globally in globals.css for .animate-drift-slow / .animate-float)
const sphereBase = 'absolute rounded-full pointer-events-none backdrop-blur-[2px] will-change-transform'

export default function AuthScreen({ onAuthed }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState<null | 'email' | 'google'>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [googleConfigured, setGoogleConfigured] = useState(false)
  const [googleCodeFlowReady, setGoogleCodeFlowReady] = useState(false)
  const [googleSetupOpen, setGoogleSetupOpen] = useState(false)

  // Fetch OAuth config (Google only)
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/config')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setGoogleConfigured(!!data.google?.configured)
          setGoogleCodeFlowReady(!!data.google?.codeFlowReady)
        }
      })
      .catch(() => {
        if (!cancelled) setGoogleConfigured(false)
      })
    return () => { cancelled = true }
  }, [])

  const switchMode = (newMode: Mode) => {
    setErrors({})
    setMode(newMode)
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (mode === 'signup' && !name.trim()) e.name = 'Please enter your name'
    if (!email.trim()) e.email = 'Please enter your email'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email'
    if (!password) e.password = 'Please enter a password'
    else if (mode === 'signup' && password.length < 6) e.password = 'At least 6 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleEmailAuth = async () => {
    if (!validate()) return
    setLoading('email')
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Something went wrong')
        setLoading(null)
        return
      }
      if (data.token && remember) {
        localStorage.setItem('chandracycle_token', data.token)
      }
      toast.success(mode === 'signup' ? 'Welcome to Nuvia!' : 'Welcome back!')
      onAuthed(data.user)
    } catch {
      toast.error('Network error. Please try again.')
      setLoading(null)
    }
  }

  // ─── Real Google OAuth path (when GOOGLE_CLIENT_ID configured) ──────────────
  const handleGoogleCredential = useCallback(async (idToken: string) => {
    setLoading('google')
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: idToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Google sign-in failed')
        setLoading(null)
        return
      }
      if (data.token && remember) {
        localStorage.setItem('chandracycle_token', data.token)
      }
      toast.success(`Signed in as ${data.user.email}`)
      onAuthed(data.user)
    } catch {
      toast.error('Network error during Google sign-in.')
      setLoading(null)
    }
  }, [remember, onAuthed])

  // ─── Real Google OAuth: three tiers, NO fake fallback ──────────────────
  // 1. codeFlowReady (Client ID + Secret): full redirect through
  //    accounts.google.com — the gold-standard real sign-in.
  // 2. configured (Client ID only): official Google Identity Services popup,
  //    verified server-side.
  // 3. not configured: open the setup dialog so the owner can paste real
  //    credentials. Entering an email is NEVER a sign-in.
  const handleGoogleClick = useCallback(() => {
    if (loading) return
    if (googleCodeFlowReady) {
      window.location.href = '/api/auth/google/authorize'
      return
    }
    if (googleConfigured) {
      // Real Google OAuth button is rendered below — it triggers its own flow
      return
    }
    setGoogleSetupOpen(true)
  }, [loading, googleConfigured, googleCodeFlowReady])

  return (
    <div className="relative min-h-dvh w-full flex flex-col lg:flex-row">
      {/* ─── Background layer (fixed so it stays put during page scroll) ────── */}
      {/* Wrapped in fixed+overflow-hidden so the negative-positioned orbs
          below can never cause horizontal document scroll, while the main
          content flows naturally via BODY scroll (the only reliable scroll
          model on iOS Safari). */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
        {/* Warm cream canvas — soft rose + peach radial washes (reference aesthetic) */}
        <div className="absolute inset-0 bg-[linear-gradient(165deg,oklch(0.985_0.015_85)_0%,oklch(0.98_0.017_350)_48%,oklch(0.975_0.024_55)_100%)] dark:bg-[linear-gradient(165deg,oklch(0.165_0.02_345)_0%,oklch(0.145_0.026_350)_48%,oklch(0.155_0.022_50)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(56rem_56rem_at_8%_-10%,oklch(0.92_0.06_355/0.6),transparent_62%),radial-gradient(48rem_48rem_at_108%_12%,oklch(0.93_0.06_55/0.55),transparent_60%),radial-gradient(52rem_52rem_at_50%_120%,oklch(0.9_0.06_305/0.32),transparent_62%)] dark:bg-[radial-gradient(56rem_56rem_at_8%_-10%,oklch(0.5_0.14_350/0.2),transparent_62%),radial-gradient(48rem_48rem_at_108%_12%,oklch(0.5_0.12_55/0.14),transparent_60%),radial-gradient(52rem_52rem_at_50%_120%,oklch(0.46_0.14_305/0.16),transparent_62%)]" />

        {/* ─── Organic glass spheres (CSS drift — reduced-motion safe) ───────── */}
        <div
          aria-hidden
          className={`${sphereBase} animate-drift-slow top-[-9%] left-[-5%] h-[22rem] w-[22rem] sm:h-[27rem] sm:w-[27rem] border border-white/70 dark:border-white/10 bg-gradient-to-br from-white/85 via-rose-100/70 to-rose-200/55 dark:from-white/10 dark:via-rose-400/10 dark:to-fuchsia-400/10 shadow-[inset_0_2px_20px_oklch(1_0_0/0.75),inset_0_-16px_32px_oklch(0.86_0.08_355/0.35),0_30px_70px_-30px_oklch(0.62_0.2_355/0.35)] opacity-80 sm:opacity-90`}
        >
          <span className="absolute left-[16%] top-[14%] h-20 w-20 rounded-full bg-white/85 blur-xl dark:bg-white/15" />
        </div>
        <div
          aria-hidden
          style={{ animationDelay: '-9s' }}
          className={`${sphereBase} animate-drift-slow bottom-[-11%] right-[-7%] h-[24rem] w-[24rem] sm:h-[30rem] sm:w-[30rem] border border-white/70 dark:border-white/10 bg-gradient-to-br from-white/85 via-amber-100/70 to-rose-200/50 dark:from-white/10 dark:via-amber-400/10 dark:to-rose-400/10 shadow-[inset_0_2px_20px_oklch(1_0_0/0.75),inset_0_-16px_32px_oklch(0.88_0.08_60/0.35),0_30px_70px_-30px_oklch(0.7_0.16_55/0.35)] opacity-75 sm:opacity-90`}
        >
          <span className="absolute right-[18%] top-[12%] h-16 w-16 rounded-full bg-white/85 blur-xl dark:bg-white/15" />
        </div>
        <div
          aria-hidden
          style={{ animationDelay: '-2.2s' }}
          className={`${sphereBase} animate-float hidden md:block top-[16%] right-[30%] xl:right-[26%] h-36 w-36 xl:h-44 xl:w-44 border border-white/70 dark:border-white/10 bg-gradient-to-br from-white/80 via-lilac/60 to-rose-100/60 dark:from-white/10 dark:via-lilac/15 dark:to-rose-300/10 shadow-[inset_0_2px_14px_oklch(1_0_0/0.7),inset_0_-10px_20px_oklch(0.85_0.06_305/0.3),0_22px_50px_-26px_oklch(0.6_0.18_305/0.35)] opacity-70`}
        >
          <span className="absolute left-[20%] top-[18%] h-8 w-8 rounded-full bg-white/85 blur-lg dark:bg-white/15" />
        </div>
      </div>

      {/* ─── Left brand panel (hidden on mobile) ──────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Brand row — glass chip with the animated Nuvia mark */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="glass rounded-2xl px-4 py-2.5 inline-flex items-center gap-3 self-start"
          >
            <BrandMark size="md" />
            <div className="flex flex-col leading-tight gap-1">
              <BrandWordmark size="md" />
              <BrandTagline
                className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground"
                dotClassName="h-[3px] w-[3px]"
              />
            </div>
          </motion.div>

          {/* Hero content in a premium glass card */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={containerStagger}
            className="max-w-xl"
          >
            <motion.div variants={fadeUp} className="glass-premium rounded-3xl p-7 xl:p-9 text-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-[11px] font-medium text-rose-700 dark:text-rose-300 border border-rose-500/20 mb-5">
                <Sparkles className="h-3 w-3" />
                Your private AI health companion
              </span>
              <motion.h1
                variants={fadeUp}
                className="text-4xl xl:text-5xl font-bold leading-[1.1] tracking-tight font-serif"
              >
                Your body,{' '}
                <span className="gradient-text-shimmer">understood.</span>
              </motion.h1>
              <motion.p
                variants={fadeUp}
                className="mt-4 text-base xl:text-lg leading-relaxed text-muted-foreground"
              >
                An intelligent ecosystem for your cycle, hormones, fertility, pregnancy and beyond — powered by AI that learns your rhythm.
              </motion.p>
            </motion.div>

            {/* Feature cards grid */}
            <motion.div
              variants={fadeUp}
              className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {features.map((f) => (
                <motion.div
                  key={f.title}
                  whileHover={{ y: -4 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                  className="glass-premium rounded-2xl p-4 flex items-start gap-3 group cursor-default"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/15 to-fuchsia-500/15 border border-rose-500/20 text-rose-600 dark:text-rose-300 transition-all duration-300 group-hover:glow-rose">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-tight">{f.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Dark contrast promo card — the one bold accent against the cream */}
            <motion.div
              variants={fadeUp}
              className="relative mt-5 max-w-lg overflow-hidden rounded-3xl bg-foreground p-5 text-background shadow-[0_24px_60px_-28px_oklch(0.2_0.03_345/0.55)] sm:p-6"
            >
              <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-rose-400/25 blur-2xl" />
              <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-amber-300/20 blur-2xl" />
              <p className="relative text-[10px] font-semibold uppercase tracking-[0.18em] text-background/55">
                New in Nuvia
              </p>
              <p className="relative mt-1.5 font-serif text-lg font-semibold leading-snug sm:text-xl">
                AI Health Coach is live — gentle 24/7 guidance tuned to your cycle.
              </p>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-background/10 px-3.5 py-1.5 text-xs font-semibold text-background transition-colors hover:bg-background/20"
              >
                Discover
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          </motion.div>

          {/* Trust footer — glass chip with foreground text */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="glass rounded-2xl px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-foreground/80"
          >
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              <span>Private &amp; encrypted end-to-end</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>AI-powered, human-centred</span>
            </div>
            <span className="text-foreground/60 italic font-serif">Crafted with care for women across India.</span>
          </motion.div>
        </div>
      </div>

      {/* ─── Right form panel ──────────────────────────────────────────────── */}
      {/* Uses natural BODY scroll (not a nested overflow-y-auto container)
          because nested scroll containers are unreliable on iOS Safari.
          min-h-dvh on root + items-center here centers the form when it fits
          the viewport; when it is taller than the viewport the root grows and
          the page scrolls from the top with no top-clipping. */}
      <div className="flex-1 lg:w-1/2 min-h-dvh flex items-center justify-center p-4 sm:p-10 relative z-10">
        <motion.div
          initial="hidden"
          animate="show"
          variants={containerStagger}
          className="w-full max-w-md py-4 sm:py-10"
        >
          {/* Mobile premium header — animated Nuvia lockup */}
          <motion.div
            variants={fadeUp}
            className="lg:hidden flex flex-col items-center text-center mb-4 sm:mb-7"
          >
            <div className="mb-3">
              <BrandMark size="lg" />
            </div>
            <BrandWordmark size="lg" className="mb-1.5" />
            <BrandTagline
              className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground"
              dotClassName="h-[3.5px] w-[3.5px]"
            />
          </motion.div>

          {/* Premium form card */}
          <motion.div variants={fadeUp} className="glass-premium rounded-3xl p-4 sm:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-xl sm:text-3xl font-bold tracking-tight font-serif">
                  {mode === 'login' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="mt-1.5 sm:mt-2 text-sm text-muted-foreground">
                  {mode === 'login'
                    ? 'Sign in to continue your wellness journey.'
                    : 'Join thousands of women taking charge of their health.'}
                </p>

                {/* Google OAuth button: real redirect flow / GIS popup / setup dialog. */}
                <div className="mt-4 sm:mt-6">
                  {googleConfigured ? (
                    <GoogleOAuthButton
                      onCredential={handleGoogleCredential}
                      loading={loading === 'google'}
                      setLoading={(v) => setLoading(v ? 'google' : null)}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11 rounded-full border-border bg-white/60 backdrop-blur-sm hover:bg-accent hover:border-rose-300 dark:border-white/10 dark:bg-white/[0.06] dark:hover:border-rose-700 text-sm font-medium gap-2.5 transition-all hover:shadow-md"
                      onClick={handleGoogleClick}
                      disabled={loading !== null}
                    >
                      {loading === 'google' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <GoogleIcon className="h-5 w-5" />
                      )}
                      <span>Continue with Google</span>
                    </Button>
                  )}
                </div>

                {/* Divider */}
                <div className="relative my-4 sm:my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="glass rounded-full px-3.5 py-1 text-xs text-muted-foreground uppercase tracking-wider">
                      or
                    </span>
                  </div>
                </div>

                {/* Email / password form */}
                <div className="space-y-3 sm:space-y-4">
                  {mode === 'signup' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-sm font-medium">Full name</Label>
                      <div className="relative">
                        <div className="pointer-events-none absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/70 text-rose-600 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-rose-300">
                          <UserIcon className="h-4 w-4" />
                        </div>
                        <Input
                          id="name"
                          type="text"
                          placeholder="Your name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="h-11 rounded-full border-border bg-white/55 pl-11 focus-visible:border-rose-400 transition-colors dark:bg-white/[0.07]"
                          onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
                        />
                      </div>
                      {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/70 text-rose-600 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-rose-300">
                        <Mail className="h-4 w-4" />
                      </div>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 rounded-full border-border bg-white/55 pl-11 focus-visible:border-rose-400 transition-colors dark:bg-white/[0.07]"
                        onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
                      />
                    </div>
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/70 text-rose-600 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-rose-300">
                        <KeyRound className="h-4 w-4" />
                      </div>
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 rounded-full border-border bg-white/55 pl-11 pr-28 focus-visible:border-rose-400 transition-colors dark:bg-white/[0.07]"
                        onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
                      />
                      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        {mode === 'login' && (
                          <button
                            type="button"
                            className="flex h-7 items-center rounded-full border border-white/80 bg-white/75 px-2.5 text-[11px] font-medium text-foreground/75 shadow-sm transition-colors hover:text-rose-700 dark:border-white/10 dark:bg-white/10 dark:text-foreground/80 dark:hover:text-rose-300"
                            onClick={() => toast.info('Password reset link would be sent to your email.')}
                          >
                            I forgot
                          </button>
                        )}
                      </div>
                    </div>
                    {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                  </div>

                  {mode === 'login' && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                      <span className="text-xs text-muted-foreground">Keep me signed in on this device</span>
                    </label>
                  )}

                  <Button
                    type="button"
                    className="btn-premium glow-rose w-full h-11 rounded-full text-sm font-semibold gap-1.5"
                    onClick={handleEmailAuth}
                    disabled={loading !== null}
                  >
                    {loading === 'email' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {mode === 'login' ? 'Sign in' : 'Create account'}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>

                {/* Sign in / Sign up toggle */}
                <p className="mt-4 sm:mt-6 text-center text-sm text-muted-foreground">
                  {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  >
                    {mode === 'login' ? 'Sign up' : 'Sign in'}
                  </button>
                </p>

                <div className="hidden sm:block mt-4 sm:mt-5 rounded-2xl border border-white/60 bg-white/45 p-3 dark:border-white/10 dark:bg-white/[0.06]">
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500 mt-0.5" />
                    <span>
                      <span className="font-medium text-foreground">Secure sign-in:</span> Continue with Google
                      opens a secure permission popup. Your password is never shared with Nuvia.
                    </span>
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <p className="mt-4 sm:mt-6 text-center text-[11px] text-muted-foreground leading-relaxed pb-[env(safe-area-inset-bottom)]">
            By continuing you agree to Nuvia&apos;s Terms of Service and Privacy Policy.
            <br />Your health data is encrypted and never sold.
          </p>
        </motion.div>
      </div>

      {/* Google Sign-In setup — paste real OAuth credentials (no fake login path exists) */}
      <GoogleSetupDialog
        open={googleSetupOpen}
        onOpenChange={setGoogleSetupOpen}
        onConfigured={() => {
          // Re-fetch config so the real Google button appears immediately
          fetch('/api/auth/config')
            .then((r) => r.json())
            .then((data) => {
              setGoogleConfigured(!!data.google?.configured)
              setGoogleCodeFlowReady(!!data.google?.codeFlowReady)
            })
            .catch(() => {})
        }}
      />
    </div>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  )
}
