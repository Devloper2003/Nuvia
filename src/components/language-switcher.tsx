'use client'

import { Languages, Check } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { LANGUAGES } from '@/lib/i18n/translations'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Compact globe dropdown for the top bars. Shows the native script of each
 * language with an active check; switching is instant and persisted.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useLanguage()
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Language: ${current.english}`}
          title={`Language: ${current.native} (${current.english})`}
          className={cn(
            'group h-9 w-9 inline-flex items-center justify-center rounded-full',
            'text-foreground/70 hover:text-foreground hover:bg-accent transition-colors',
            'outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className
          )}
        >
          <Languages className="h-[18px] w-[18px] transition-transform group-hover:scale-110" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
          Language · भाषा · மொழி
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code)}
            className={cn(
              'gap-3 rounded-lg py-2 cursor-pointer',
              l.code === lang && 'bg-primary/5 focus:bg-primary/10'
            )}
          >
            <span
              className={cn(
                'flex h-7 w-9 items-center justify-center rounded-md text-xs font-semibold',
                l.code === lang
                  ? 'bg-gradient-to-br from-amber-400 via-rose-500 to-fuchsia-600 text-white shadow-sm'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {l.short}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium leading-tight">{l.native}</span>
              <span className="block text-[11px] text-muted-foreground leading-tight">
                {l.english}
              </span>
            </span>
            {l.code === lang && <Check className="h-4 w-4 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Large segmented control used in Settings → Language & Region. Native-script
 * cards with an animated gradient active state.
 */
export function LanguageSegmented() {
  const { lang, setLang } = useLanguage()

  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Language">
      {LANGUAGES.map((l) => {
        const active = l.code === lang
        return (
          <button
            key={l.code}
            role="radio"
            aria-checked={active}
            onClick={() => setLang(l.code)}
            className={cn(
              'relative flex flex-col items-center gap-0.5 rounded-xl border px-2 py-3 text-center transition-all duration-200',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              active
                ? 'border-transparent bg-gradient-to-br from-amber-400 via-rose-500 to-fuchsia-600 text-white shadow-lg shadow-rose-500/25 scale-[1.02]'
                : 'border-border bg-card hover:border-rose-300 hover:bg-accent/60 text-foreground'
            )}
          >
            <span className={cn('text-base font-semibold leading-none', !active && 'font-serif')}>
              {l.native}
            </span>
            <span
              className={cn(
                'text-[10px] leading-none mt-1',
                active ? 'text-white/85' : 'text-muted-foreground'
              )}
            >
              {l.english}
            </span>
            {active && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-white shadow flex items-center justify-center">
                <Check className="h-2.5 w-2.5 text-rose-600" strokeWidth={3.5} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
