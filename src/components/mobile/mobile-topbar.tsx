'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Crown, Sparkles, HelpCircle } from 'lucide-react'
import { useAppStore, ActiveModule } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import NotificationPanel from '@/components/notifications/notification-panel'
import { useLanguage } from '@/components/language-provider'
import { LanguageSwitcher } from '@/components/language-switcher'
import type { TranslationKey } from '@/lib/i18n/translations'

interface MobileTopbarProps {
  onTakeTour?: () => void
  userId?: string
  displayName?: string
}

/* ─── Module label keys (kept in sync with app-shell navItems) ───────────── */

const MODULE_LABELS: Record<ActiveModule, TranslationKey> = {
  dashboard: 'nav.dashboard',
  period: 'nav.period',
  hormone: 'nav.hormone',
  symptoms: 'nav.symptoms',
  pcos: 'nav.pcos',
  fertility: 'nav.fertility',
  pregnancy: 'nav.pregnancy',
  menopause: 'nav.menopause',
  coach: 'nav.coach',
  diet: 'nav.diet',
  doctors: 'nav.doctors',
  mental: 'nav.mental',
  fitness: 'nav.fitness',
  beauty: 'nav.beauty',
  community: 'nav.community',
  reports: 'nav.reports',
  marketplace: 'nav.marketplace',
  'ai-insights': 'nav.insights',
  premium: 'nav.premium',
  settings: 'nav.settings',
}

export default function MobileTopbar({ onTakeTour, userId, displayName }: MobileTopbarProps) {
  const activeModule = useAppStore((s) => s.activeModule)
  const setActiveModule = useAppStore((s) => s.setActiveModule)
  const hasPremium = useAppStore((s) => s.hasPremium())
  const { t } = useLanguage()

  const label = t(MODULE_LABELS[activeModule] ?? 'nav.dashboard')

  return (
    <header
      role="banner"
      className="lg:hidden sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-xl pt-[env(safe-area-inset-top)]"
    >
      <div className="flex h-14 items-center justify-between px-3">
        {/* Left: logo + module name */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => setActiveModule('dashboard')}
          aria-label="Go to dashboard"
          className="flex items-center gap-2.5 min-w-0"
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 via-pink-500 to-rose-600 text-white font-bold shadow-md shadow-rose-500/30">
            <span className="text-base font-serif">C</span>
            <Sparkles className="absolute -top-0.5 -right-0.5 h-3 w-3 text-amber-400 fill-amber-400" />
          </div>
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="text-[10px] font-medium text-muted-foreground -mb-0.5">ChandraCycle</span>
            <span className="text-sm font-semibold truncate max-w-[38vw]">{label}</span>
          </div>
        </motion.button>

        {/* Right: language + bell + premium crown + avatar */}
        <div className="flex items-center gap-0.5">
          <LanguageSwitcher className="h-10 w-10" />

          {hasPremium ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setActiveModule('premium')}
              aria-label="ChandraCycle Premium active"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 text-white shadow-sm"
            >
              <Crown className="h-4 w-4" />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setActiveModule('premium')}
              aria-label="Upgrade to ChandraCycle Premium"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300"
            >
              <Crown className="h-4 w-4" />
            </motion.button>
          )}

          {userId && <NotificationPanel userId={userId} />}

          {onTakeTour && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={onTakeTour}
              aria-label="Take a guided tour"
              data-tour="replay"
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-accent transition-colors"
            >
              <HelpCircle className="h-[18px] w-[18px]" />
            </motion.button>
          )}

          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => setActiveModule('settings')}
            aria-label="Open settings"
            data-tour="mobile-profile"
            className="ml-0.5"
          >
            <Avatar className={cn('h-10 w-10 ring-2 ring-primary/20')}>
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {(displayName ?? 'U').trim().charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </motion.button>
        </div>
      </div>
    </header>
  )
}
