'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Copy, Check, ExternalLink, ShieldCheck, KeyRound, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

// ─── Google Sign-In setup dialog ─────────────────────────────────────────────
// Real Google sign-in requires an OAuth 2.0 client that only the app owner can
// create (Google Cloud Console). This dialog makes it self-service:
//   1. Shows the exact Authorized JavaScript origin + redirect URI to paste
//      into the Google Cloud Console (copy buttons).
//   2. Accepts the Client ID + Client Secret and saves them server-side
//      (Settings model), no .env editing needed.
//   3. After saving, the login screen immediately switches to the REAL Google
//      flow (redirect through accounts.google.com) — no fake fallbacks.

interface SetupInfo {
  origin: string
  redirectUri: string
  google: {
    configured: boolean
    codeFlowReady: boolean
    source: string
    maskedClientId: string
    dbStored: { clientId: boolean; clientSecret: boolean }
  }
}

interface GoogleSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfigured?: () => void // called after credentials are saved successfully
}

export default function GoogleSetupDialog({ open, onOpenChange, onConfigured }: GoogleSetupDialogProps) {
  const [info, setInfo] = useState<SetupInfo | null>(null)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [copied, setCopied] = useState<'origin' | 'callback' | null>(null)

  const loadInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/google/credentials')
      if (res.ok) setInfo((await res.json()) as SetupInfo)
    } catch {
      /* dialog still shows manual instructions */
    }
  }, [])

  useEffect(() => {
    if (open) void loadInfo()
  }, [open, loadInfo])

  const copy = async (text: string, which: 'origin' | 'callback') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error('Could not copy — select the text manually')
    }
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/auth/google/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not save credentials')
        return
      }
      toast.success('Google Sign-In configured! Use "Continue with Google" now.')
      setClientId('')
      setClientSecret('')
      await loadInfo()
      onConfigured?.()
      onOpenChange(false)
    } catch {
      toast.error('Network error while saving credentials')
    } finally {
      setSaving(false)
    }
  }

  const clear = async () => {
    if (clearing) return
    setClearing(true)
    try {
      const res = await fetch('/api/auth/google/credentials', { method: 'DELETE' })
      if (res.ok) {
        toast.success('Stored credentials cleared')
        await loadInfo()
        onConfigured?.()
      } else {
        toast.error('Could not clear credentials')
      }
    } finally {
      setClearing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] max-h-[90dvh] overflow-y-auto rounded-3xl" aria-label="Set up Google Sign-In">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            Enable real Google Sign-In
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Nuvia only accepts <strong>real, Google-verified</strong> sign-ins. Create a free OAuth
            client (takes ~3 minutes) and paste it below — no .env editing needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1 — Google Cloud Console */}
          <div className="rounded-2xl border border-border bg-muted/30 p-3.5 space-y-2.5">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">1</span>
              Create the OAuth client in Google Cloud
            </p>
            <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
              <li>
                Open{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  console.cloud.google.com/apis/credentials
                  <ExternalLink className="h-3 w-3" />
                </a>{' '}
                and sign in
              </li>
              <li>Create Credentials → OAuth client ID → <strong>Web application</strong></li>
              <li>Paste these two URLs into the matching fields:</li>
            </ol>

            <div className="space-y-2 pt-1">
              <div>
                <Label className="text-[10px] text-muted-foreground">Authorized JavaScript origin</Label>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Input readOnly value={info?.origin || window.location.origin} className="h-9 text-[11px] font-mono bg-background" onFocus={(e) => e.currentTarget.select()} />
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => copy(info?.origin || window.location.origin, 'origin')} aria-label="Copy origin">
                    {copied === 'origin' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Authorized redirect URI</Label>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Input readOnly value={info?.redirectUri || `${window.location.origin}/api/auth/google/callback`} className="h-9 text-[11px] font-mono bg-background" onFocus={(e) => e.currentTarget.select()} />
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => copy(info?.redirectUri || `${window.location.origin}/api/auth/google/callback`, 'callback')} aria-label="Copy redirect URI">
                    {copied === 'callback' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 — paste credentials */}
          <div className="rounded-2xl border border-border bg-muted/30 p-3.5 space-y-2.5">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">2</span>
              Paste the credentials here
            </p>
            <div className="space-y-2">
              <div>
                <Label htmlFor="g-client-id" className="text-[10px] text-muted-foreground">Client ID (ends with .apps.googleusercontent.com)</Label>
                <Input
                  id="g-client-id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="1234567890-xxxx.apps.googleusercontent.com"
                  className="h-9 text-[11px] font-mono"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div>
                <Label htmlFor="g-client-secret" className="text-[10px] text-muted-foreground">Client secret (starts with GOCSPX-)</Label>
                <Input
                  id="g-client-secret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="GOCSPX-••••"
                  className="h-9 text-[11px] font-mono"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={save}
              disabled={saving || !clientId.trim() || !clientSecret.trim()}
              className="w-full h-10 rounded-full text-sm font-semibold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save & enable real Google Sign-In'}
            </Button>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Stored securely in your app&apos;s database — the secret is never sent back to the
              browser. Environment variables (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) take
              precedence if set.
            </p>
          </div>

          {/* Current status */}
          {info?.google && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-border px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold">
                  Status: {info.google.configured ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Real Google Sign-In active ({info.google.source === 'env' ? 'environment' : 'in-app'})
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">Not configured yet</span>
                  )}
                </p>
                {info.google.maskedClientId && (
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{info.google.maskedClientId}</p>
                )}
              </div>
              {info.google.dbStored.clientId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clear}
                  disabled={clearing}
                  className="h-8 shrink-0 text-[11px] text-muted-foreground hover:text-rose-600"
                >
                  {clearing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
