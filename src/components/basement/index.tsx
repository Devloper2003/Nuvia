'use client'

// ─── Basement orchestrator ───────────────────────────────────────────────────
// Owns the lock state machine: hidden → gate → control centre. The operator
// bearer lives in sessionStorage (tab-scoped — closing the tab ends the
// session). Resume is optimistic: a stale token is rejected by the first
// basement API call (401 → session cleared → gate re-appears), so a dead
// session can never resurrect the console.

import { useCallback, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { BasementGate } from './basement-gate'
import { ControlCentre } from './control-centre'
import { ADMIN_TOKEN_KEY, BasementOperator } from './basement-shared'

const OPERATOR_KEY = 'nuvia_admin_operator'

interface BasementSession {
  token: string | null
  operator: BasementOperator | null
}

function readSavedSession(): BasementSession {
  if (typeof window === 'undefined') return { token: null, operator: null }
  try {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY)
    const rawOperator = sessionStorage.getItem(OPERATOR_KEY)
    if (token && rawOperator) {
      return { token, operator: JSON.parse(rawOperator) as BasementOperator }
    }
  } catch {
    /* storage unavailable — gate will ask for credentials */
  }
  return { token: null, operator: null }
}

export function Basement({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [session, setSession] = useState<BasementSession>(readSavedSession)

  const persist = useCallback((token: string, operator: BasementOperator) => {
    try {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
      sessionStorage.setItem(OPERATOR_KEY, JSON.stringify(operator))
    } catch {
      /* best effort — session just won't survive reloads */
    }
    setSession({ token, operator })
  }, [])

  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY)
      sessionStorage.removeItem(OPERATOR_KEY)
    } catch {
      /* best effort */
    }
    setSession({ token: null, operator: null })
  }, [])

  if (!open) return null

  return (
    <AnimatePresence>
      {session.token && session.operator ? (
        <ControlCentre
          key="centre"
          token={session.token}
          operator={session.operator}
          onLock={clear}
          onClose={onClose}
        />
      ) : (
        <BasementGate key="gate" onSuccess={persist} onClose={onClose} />
      )}
    </AnimatePresence>
  )
}
