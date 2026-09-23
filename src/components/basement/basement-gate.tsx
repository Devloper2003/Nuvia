'use client'

// ─── Basement gate ───────────────────────────────────────────────────────────
// The hidden entry. Renders ONLY when a secret trigger fires (logo 7-click,
// Ctrl/Cmd+Shift+B, or #basement hash) — it never appears in navigation,
// sitemaps or any surface UI. Operator signs in with email + password just
// like the normal app login, but against the AdminUser table via
// /api/admin/login (rate-limited, DB-backed 24h session).

import { useState } from 'react'
import { motion } from 'framer-motion'
import { KeyRound, Loader2, Lock, ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { inputDarkCls, BasementOperator } from './basement-shared'

export function BasementGate({
  onSuccess,
  onClose,
}: {
  onSuccess: (token: string, operator: BasementOperator) => void
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (busy) return
    setError(null)
    if (!email.trim() || !password) {
      setError('Operator email and password are required.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Authentication failed.')
        return
      }
      onSuccess(data.token as string, data.admin as BasementOperator)
    } catch {
      setError('Network error — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(120,53,79,0.22), transparent 60%), #0a0810',
      }}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      {/* subtle scanlines for the ops-centre vibe */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 3px)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm rounded-2xl border border-white/12 bg-[#12101c]/90 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
      >
        <button
          onClick={onClose}
          aria-label="Close basement gate"
          className="absolute right-3 top-3 rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="absolute inset-0 animate-pulse rounded-full bg-amber-400/20 blur-lg" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10">
              <Lock className="h-6 w-6 text-amber-300" />
            </div>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-amber-300/80">Restricted</p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-100">NUVIA // BASEMENT</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Operator control centre — sign in to continue
          </p>
        </div>

        <div className="mt-6 space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="basement-email" className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Operator email
            </Label>
            <Input
              id="basement-email"
              type="email"
              autoComplete="off"
              className={inputDarkCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@nuvia.app"
              onKeyDown={(e) => e.key === 'Enter' && password && handleSubmit()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="basement-password" className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Password
            </Label>
            <Input
              id="basement-password"
              type="password"
              autoComplete="off"
              className={inputDarkCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300"
              role="alert"
            >
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={busy}
            className="w-full bg-amber-400 text-[#0a0810] hover:bg-amber-300 font-semibold"
          >
            {busy ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Authenticating…</>
            ) : (
              <><KeyRound className="h-4 w-4" /> Enter the basement</>
            )}
          </Button>

          <p className="text-center text-[10px] leading-relaxed text-zinc-600">
            Authorized operators only · every attempt is logged · brute-force is rate-limited
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
