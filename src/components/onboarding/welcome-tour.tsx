'use client'

/**
 * WelcomeTour — first-time onboarding tour for Nuvia.
 *
 * How it works
 * ─────────────
 * • Rendered once at the AppShell root, controlled by `open` / `onClose`.
 * • Walks the user through 9 steps (welcome → sidebar → dashboard → period →
 *   coach → symptoms → profile → premium → done).
 * • Each step has an optional `targetSelector` (CSS selector) for an element
 *   to spotlight. When found, a "cutout" is drawn around it using the
 *   `box-shadow: 0 0 0 9999px rgba(0,0,0,.72)` trick on a positioned div.
 * • The tooltip card is positioned next to the cutout (top/bottom/left/right)
 *   or centered on screen for intro/outro steps.
 * • Resilient — if a target isn't found (e.g. on mobile where the desktop
 *   sidebar is hidden), the step falls back to a centered modal with the
 *   mobile-specific copy. The tour never throws.
 * • Mobile-aware — uses window.innerWidth < 1024 to detect mobile and swaps
 *   in alternative targets (MobileTopbar avatar, MobileBottomNav grid/Coach
 *   FAB) and shorter, mobile-appropriate copy.
 * • Stores the "seen" flag in localStorage at `nuvia_tour_seen` —
 *   AppShell calls onClose which sets the flag; Settings can clear it to
 *   replay. The "Take Tour" button in the sidebar/mobile topbar reopens the
 *   tour without touching the seen flag.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  Heart,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center'

export interface TourStep {
  id: string
  title: string
  body: string
  /** CSS selector for the element to spotlight. null = centered modal. */
  targetSelector: string | null
  placement: TourPlacement
  /** Optional emoji/icon badge shown on the gradient header. */
  emoji?: string
  /** Override body copy shown when running on mobile. */
  mobileBody?: string
  /** Override target selector used on mobile (null = no spotlight, centered). */
  mobileTargetSelector?: string | null
  /** Override placement on mobile. */
  mobilePlacement?: TourPlacement
}

/** localStorage key prefix — shared with Settings "Replay tour" button.
 *  Per-user so a new signup always sees the tour even if another user
 *  dismissed it on the same browser. */
export const TOUR_SEEN_KEY = 'nuvia_tour_seen'

/** Initial height ESTIMATE for the tooltip card, used until the real rendered
 *  height has been measured (see cardH state inside WelcomeTour). */
const CARD_HEIGHT_ESTIMATE = 320

/** Build a per-user "tour seen" localStorage key. Falls back to the legacy
 *  global key when no userId is available so existing flags still work. */
export function getTourSeenKey(userId?: string | null): string {
  return userId ? `${TOUR_SEEN_KEY}_${userId}` : TOUR_SEEN_KEY
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Nuvia',
    body: "Your AI-powered women's health companion. Let's take a quick 60-second tour to show you around — you can skip any time.",
    targetSelector: null,
    placement: 'center',
    emoji: '🌙',
  },
  {
    id: 'sidebar',
    title: 'Navigation Sidebar',
    body: 'Browse all 18+ health modules here — Period Tracker, AI Coach, Fertility, PCOS, Pregnancy, Menopause and more. Click any item to switch modules instantly.',
    targetSelector: 'aside',
    placement: 'right',
    emoji: '🧭',
    mobileBody:
      'On mobile, tap the "More" grid icon in the bottom navigation to browse all 18+ health modules in one place.',
    mobileTargetSelector: '[data-tour="mobile-more"]',
    mobilePlacement: 'top',
  },
  {
    id: 'dashboard',
    title: 'Your Dashboard',
    body: 'Your daily health snapshot lives here — cycle status, quick stats, AI insights, and reminders. This is your home base.',
    targetSelector: 'main',
    placement: 'left',
    emoji: '📊',
    mobileBody:
      'Your daily health snapshot lives here — cycle status, quick stats, AI insights, and reminders. This is your home base.',
  },
  {
    id: 'period',
    title: 'Log Your Period',
    body: 'Tap here to log your period. Once you log your first period, Nuvia predicts ovulation, fertile windows, and your next period automatically. This is the most important first step!',
    targetSelector: '[data-tour="period"]',
    placement: 'right',
    emoji: '🩸',
    mobileBody:
      'Tap the "Period" tab in the bottom navigation to log your cycle. Once logged, Nuvia predicts ovulation, fertile windows, and your next period automatically — this is the most important first step!',
    mobileTargetSelector: '[data-tour="mobile-period"]',
    mobilePlacement: 'top',
  },
  {
    id: 'coach',
    title: 'AI Health Coach',
    body: 'Your AI Health Coach is available 24/7. Ask about symptoms, diet, mood, fertility — anything. Tap here to start chatting.',
    targetSelector: '[data-tour="coach"]',
    placement: 'right',
    emoji: '💬',
    mobileBody:
      'Tap the floating pink AI Coach button to start chatting — your AI Health Coach is available 24/7 for cycle questions, symptom analysis, diet tips, and emotional support.',
    mobileTargetSelector: '[data-tour="mobile-coach"]',
    mobilePlacement: 'top',
  },
  {
    id: 'symptoms',
    title: 'Track Daily Symptoms',
    body: 'Log your mood, energy, sleep, water intake, and physical symptoms daily. Nuvia uses this to find patterns in your cycle.',
    targetSelector: '[data-tour="symptoms"]',
    placement: 'right',
    emoji: '💓',
    mobileBody:
      'Open the "More" menu and tap "Symptoms" to log your mood, energy, sleep, water intake, and physical symptoms daily. Nuvia uses this to find patterns in your cycle.',
    mobileTargetSelector: null,
    mobilePlacement: 'center',
  },
  {
    id: 'profile',
    title: 'Your Profile & Settings',
    body: 'Tap your avatar to access settings, manage your subscription, view your profile, or sign out. You can also replay this tour from Settings any time.',
    targetSelector: '[data-tour="profile"]',
    placement: 'bottom',
    emoji: '👤',
    mobileBody:
      'Tap your avatar in the top bar to access settings, manage your subscription, view your profile, or sign out. You can also replay this tour from Settings any time.',
    mobileTargetSelector: '[data-tour="mobile-profile"]',
    mobilePlacement: 'bottom',
  },
  {
    id: 'premium',
    title: 'Go Premium',
    body: 'Unlock advanced insights, unlimited AI coaching, all health modules, and an ad-free experience. Tap "Go Premium" to see what\'s included.',
    targetSelector: '[data-tour="premium"]',
    placement: 'top',
    emoji: '👑',
    mobileBody:
      'Open the "More" menu and tap "Unlock Nuvia Premium" for advanced insights, unlimited AI coaching, and an ad-free experience.',
    mobileTargetSelector: null,
    mobilePlacement: 'center',
  },
  {
    id: 'done',
    title: "You're all set!",
    body: "That's it! Start by logging your first period from the Period Tracker, then explore other modules as you go. Your data stays private and end-to-end encrypted. 💖",
    targetSelector: null,
    placement: 'center',
    emoji: '🎉',
  },
]

interface WelcomeTourProps {
  open: boolean
  onClose: () => void
}

export default function WelcomeTour({ open, onClose }: WelcomeTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  // Real rendered height of the tooltip card. Placement math uses this instead
  // of a static estimate — on narrow phones the copy wraps to more lines than
  // any guess can cover, which used to push the card past the viewport bottom.
  const [cardH, setCardH] = useState(CARD_HEIGHT_ESTIMATE)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── SSR-safe mount flag (matches the pattern used in settings.tsx) ─────────
  // Returns false during SSR/initial render, then true on the client. This
  // avoids hydration mismatches when reading window/localStorage.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  // ── Mobile detection ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [mounted])

  // ── Reset to step 0 whenever tour opens ───────────────────────────────────
  // Done via a key prop on the parent (<WelcomeTour key={open ? 'on' : 'off'}>)
  // so React remounts the component with fresh state — no setState-in-effect.

  const currentStep = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0]

  // ── Resolve the active step's config, accounting for mobile fallback ──────
  const resolveStep = useCallback(
    (step: TourStep) => {
      const onMobile = isMobile
      const selector =
        onMobile && step.mobileTargetSelector !== undefined
          ? step.mobileTargetSelector
          : step.targetSelector
      const placement =
        onMobile && step.mobilePlacement
          ? step.mobilePlacement
          : step.placement
      const body =
        onMobile && step.mobileBody ? step.mobileBody : step.body
      return { selector, placement, body }
    },
    [isMobile],
  )

  const { selector: activeSelector, placement: activePlacement, body: activeBody } =
    resolveStep(currentStep)

  // ── Measure the target element ────────────────────────────────────────────
  const measure = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (!open) return
      if (!activeSelector) {
        setRect(null)
        return
      }
      const el = document.querySelector<HTMLElement>(activeSelector)
      if (!el) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      // If the element is meaningfully off-screen, scroll it into view first
      // and re-measure once the scroll settles.
      const margin = 80
      const offscreen =
        r.top < margin ||
        r.bottom > window.innerHeight - margin ||
        r.left < margin ||
        r.right > window.innerWidth - margin
      if (offscreen) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
        if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
        scrollTimerRef.current = setTimeout(() => {
          const el2 = document.querySelector<HTMLElement>(activeSelector)
          if (el2) {
            const r2 = el2.getBoundingClientRect()
            // Treat zero-size / hidden elements as "no spotlight"
            if (r2.width > 4 && r2.height > 4) setRect(r2)
            else setRect(null)
          } else {
            setRect(null)
          }
        }, 380)
        return
      }
      if (r.width > 4 && r.height > 4) setRect(r)
      else setRect(null)
    })
  }, [open, activeSelector])

  // Re-measure on step change / open / mobile change
  useEffect(() => {
    if (!open) return
    measure()
  }, [open, stepIndex, isMobile, measure])

  // ── Keep cardH in sync with the real card height ────────────────────────────
  // Re-measured after every step render (copy changes height per step) and on
  // viewport resize. Converges: setCardH only fires when the height moved >2px.
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      const h = cardRef.current?.offsetHeight
      if (h && Math.abs(h - cardH) > 2) setCardH(h)
    })
    return () => cancelAnimationFrame(id)
  }, [open, stepIndex, isMobile, cardH])

  // Listen to scroll & resize to keep the spotlight glued to its target
  useEffect(() => {
    if (!open) return
    const handler = () => measure()
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    // Periodic re-measure catches sidebar collapse / module animation settle.
    const interval = setInterval(measure, 700)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
      clearInterval(interval)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    }
  }, [open, measure])

  // ── Controls ──────────────────────────────────────────────────────────────
  if (!mounted || !open) return null

  const handleNext = () => {
    if (stepIndex < TOUR_STEPS.length - 1) setStepIndex((i) => i + 1)
    else onClose()
  }
  const handleBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1)
  }
  const handleSkip = () => {
    onClose()
  }

  // ── Tooltip placement math ────────────────────────────────────────────────
  // NOTE: positioning NEVER relies on a CSS `transform` — framer-motion writes
  // its own transform while animating scale/y, which would wipe out a
  // `translate(-50%, -50%)` centering offset and throw the card into the
  // bottom-right quadrant (cut off on mobile — seen on iPhone Safari).
  // Centering is done with flex instead; spotlight placement uses numeric
  // top/left only.
  const CARD_WIDTH = 360
  const GAP = 16
  const edge = 16
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const vwW = typeof window !== 'undefined' ? window.innerWidth : 1200
  const hClamp = Math.min(cardH, vh - edge * 2)
  // Effective width accounts for small viewports so positioning math never
  // pushes the tooltip off-screen on mobile (e.g. 320px wide phones).
  const effectiveWidth = Math.min(CARD_WIDTH, (typeof window !== 'undefined' ? window.innerWidth : 1200) - edge * 2)

  const tooltipStyle: React.CSSProperties = rect
    ? (() => {
        const style: React.CSSProperties = {
          position: 'fixed',
          width: effectiveWidth,
          maxWidth: `calc(100vw - ${edge * 2}px)`,
          maxHeight: 'calc(100dvh - 32px)',
          zIndex: 62,
        }
        switch (activePlacement) {
          case 'top': {
            // Prefer above the target; if the card would poke past the top
            // edge AND fits below instead, flip below (typical mobile case:
            // tall card + bottom-nav target).
            const above = rect.top - hClamp - GAP
            if (above >= edge || rect.bottom + hClamp + GAP > vh) {
              style.top = Math.max(edge, above)
            } else {
              style.top = Math.min(rect.bottom + GAP, vh - hClamp - edge)
            }
            const proposedLeft = rect.left + rect.width / 2 - effectiveWidth / 2
            style.left = Math.min(
              Math.max(edge, proposedLeft),
              vwW - effectiveWidth - edge,
            )
            break
          }
          case 'bottom': {
            style.top = Math.max(
              edge,
              Math.min(rect.bottom + GAP, vh - hClamp - edge),
            )
            const proposedLeft = rect.left + rect.width / 2 - effectiveWidth / 2
            style.left = Math.min(
              Math.max(edge, proposedLeft),
              vwW - effectiveWidth - edge,
            )
            break
          }
          case 'left': {
            style.left = Math.max(edge, rect.left - effectiveWidth - GAP)
            const proposedTop = rect.top + rect.height / 2 - hClamp / 2
            style.top = Math.min(
              Math.max(edge, proposedTop),
              vh - hClamp - edge,
            )
            break
          }
          case 'right': {
            style.left = Math.min(
              vwW - effectiveWidth - edge,
              rect.right + GAP,
            )
            const proposedTop = rect.top + rect.height / 2 - hClamp / 2
            style.top = Math.min(
              Math.max(edge, proposedTop),
              vh - hClamp - edge,
            )
            break
          }
          default: {
            // Numeric centering — no transform (framer-motion owns transform).
            style.width = effectiveWidth
            style.left = Math.max(
              edge,
              Math.round((vwW - effectiveWidth) / 2),
            )
            style.top = Math.max(
              edge,
              Math.min(
                Math.round((vh - hClamp) / 2),
                vh - hClamp - edge,
              ),
            )
          }
        }
        return style
      })()
    : {
        // Centered fallback (intro/outro steps & steps without a target):
        // a full-screen flex container centers the card WITHOUT transforms,
        // so framer-motion's scale/y animation can never knock it off-center.
        // Padding respects iOS/Android safe areas (notches, home indicator).
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding:
          'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
        zIndex: 62,
      }

  const isFirst = stepIndex === 0
  const isLast = stepIndex === TOUR_STEPS.length - 1

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label="Nuvia onboarding tour"
    >
      {/* ── Dark overlay (when no spotlight is active) ─────────────────────── */}
      {!rect && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/72 backdrop-blur-[2px]"
        />
      )}

      {/* ── Spotlight highlighter (box-shadow cutout trick) ────────────────── */}
      <AnimatePresence>
        {rect && (
          <motion.div
            key={currentStep.id + '-spot'}
            initial={false}
            animate={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
            }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{
              position: 'fixed',
              borderRadius: 14,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
              pointerEvents: 'none',
              zIndex: 61,
            }}
            className="ring-2 ring-gold/90 ring-offset-0"
          />
        )}
      </AnimatePresence>

      {/* ── Tooltip card ────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep.id}
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -10 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          style={tooltipStyle}
        >
          <Card
            ref={cardRef}
            className={cn(
              'overflow-hidden border-gold/40 shadow-2xl shadow-primary/25 max-h-[calc(100dvh-32px)] flex flex-col',
              // Only the centered fallback spans its flex container; spotlight
              // cards fill the numeric width from tooltipStyle instead.
              !rect && 'w-full max-w-[440px]',
            )}
          >
            {/* Gradient header — signature plum→rose (matches brand FAB) */}
            <div className="relative bg-gradient-to-r from-[#6E366F] via-[#8E4463] to-[#C2497E] p-4 text-white">
              <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/15 blur-2xl pointer-events-none" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {currentStep.emoji && (
                    <span className="text-base leading-none" aria-hidden>
                      {currentStep.emoji}
                    </span>
                  )}
                  <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-white/90">
                    Step {stepIndex + 1} of {TOUR_STEPS.length}
                  </span>
                </div>
                <button
                  onClick={handleSkip}
                  aria-label="Skip tour"
                  className="rounded-full p-2.5 hover:bg-white/25 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h3 className="relative text-lg font-bold mt-1.5 leading-tight">
                {currentStep.title}
              </h3>
            </div>

            <CardContent className="p-4 overflow-y-auto">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {activeBody}
              </p>

              {/* Progress dots */}
              <div className="flex items-center gap-0.5 mt-4">
                {TOUR_STEPS.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setStepIndex(i)}
                    aria-label={`Go to step ${i + 1}: ${s.title}`}
                    className="h-8 w-8 flex items-center justify-center rounded-full transition-colors hover:bg-muted/40"
                  >
                    <span
                      className={cn(
                        'h-1.5 rounded-full transition-all',
                        i === stepIndex
                          ? 'w-6 bg-gradient-to-r from-gold to-amber-400'
                          : 'w-1.5 bg-muted-foreground/30',
                      )}
                    />
                  </button>
                ))}
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-between mt-4 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Skip tour
                </Button>
                <div className="flex items-center gap-1.5">
                  {!isFirst && (
                    <Button variant="ghost" size="sm" onClick={handleBack}>
                      <ChevronLeft className="h-4 w-4 mr-0.5" />
                      Back
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleNext}
                    className="btn-plum rounded-full min-h-11 border-0"
                  >
                    {isLast ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Get started
                      </>
                    ) : isFirst ? (
                      <>
                        Start tour
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {isLast && (
                <p className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-muted-foreground">
                  <Heart className="h-3 w-3 text-rose-500 fill-rose-500" />
                  Made with care for women everywhere
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Subtle floating sparkle in the corner of centered steps for polish */}
      {!rect && !isLast && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 0.3 }}
          className="absolute bottom-6 right-6 text-gold/60 pointer-events-none"
        >
          <Sparkles className="h-6 w-6" />
        </motion.div>
      )}
    </div>
  )
}
