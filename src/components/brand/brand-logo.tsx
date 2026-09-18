import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Nuvia brand kit — animated logo mark, wordmark and tagline.
 *
 * Deliberately CSS-animation-only (no framer-motion) so it is:
 *  - hydration-safe when rendered on the server (AppLoader / dynamic fallbacks)
 *  - light enough to include in the initial bundle
 *
 * All animations are disabled under `prefers-reduced-motion` via globals.css.
 */

const MARK_SIZES = {
  xs: { tile: 'h-8 w-8 rounded-lg', halo: '-inset-1 rounded-xl' },
  sm: { tile: 'h-10 w-10 rounded-xl', halo: '-inset-1 rounded-2xl' },
  md: { tile: 'h-11 w-11 rounded-xl', halo: '-inset-1.5 rounded-2xl' },
  lg: { tile: 'h-14 w-14 rounded-2xl', halo: '-inset-1.5 rounded-[1.2rem]' },
  xl: { tile: 'h-20 w-20 rounded-[1.4rem]', halo: '-inset-2 rounded-[1.8rem]' },
} as const

export type BrandMarkSize = keyof typeof MARK_SIZES

/**
 * The animated Nuvia lotus-mark inside a glass tile:
 * breathing glow halo · orbiting dashed ring · gentle float · light sheen sweep.
 */
export function BrandMark({
  size = 'sm',
  className,
  float = true,
}: {
  size?: BrandMarkSize
  className?: string
  float?: boolean
}) {
  const s = MARK_SIZES[size]
  return (
    <span className={cn('relative inline-block shrink-0', className)}>
      {/* Breathing halo */}
      <span
        aria-hidden
        className={cn(
          'animate-brand-halo absolute bg-gradient-to-br from-rose-400/50 via-pink-400/40 to-fuchsia-400/45 blur-lg',
          s.halo
        )}
      />
      {/* Orbiting dashed ring */}
      <span
        aria-hidden
        className="animate-brand-spin absolute -inset-2 rounded-[1.3rem] border border-dashed border-rose-400/30 dark:border-rose-300/25"
      />
      {/* Glass tile with the mark */}
      <span
        className={cn(
          'relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-white via-rose-50 to-fuchsia-100 ring-1 ring-rose-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_26px_-10px_rgba(190,24,93,0.5)]',
          s.tile,
          float && 'animate-brand-float'
        )}
      >
        <Image
          src="/brand/nuvia-mark.png"
          alt="Nuvia logo"
          width={512}
          height={512}
          sizes="80px"
          priority
          className="h-[88%] w-[88%] object-contain"
        />
        {/* Light sheen sweep */}
        <span aria-hidden className="pointer-events-none absolute inset-0">
          <span className="animate-brand-sheen block h-full w-1/3 bg-gradient-to-r from-transparent via-white/75 to-transparent" />
        </span>
      </span>
    </span>
  )
}

/**
 * "Nuvia" wordmark — plum→rose shimmer gradient (matches the logo).
 */
export function BrandWordmark({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const sizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-4xl sm:text-5xl',
  } as const
  return (
    <span
      className={cn(
        'brand-wordmark font-serif font-bold leading-none tracking-tight',
        sizes[size],
        className
      )}
    >
      Nuvia
    </span>
  )
}

/**
 * "Track • Understand • Thrive" — with softly pulsing separator dots.
 */
export function BrandTagline({
  className,
  dotClassName,
}: {
  className?: string
  dotClassName?: string
}) {
  const words = ['Track', 'Understand', 'Thrive']
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      {words.map((word, i) => (
        <span key={word} className="inline-flex items-center gap-1.5">
          {i > 0 && (
            <span
              aria-hidden
              className={cn(
                'brand-dot inline-block h-1 w-1 rounded-full bg-rose-500 dark:bg-rose-400',
                dotClassName
              )}
              style={{ animationDelay: `${i * 0.5}s` }}
            />
          )}
          <span>{word}</span>
        </span>
      ))}
    </span>
  )
}
