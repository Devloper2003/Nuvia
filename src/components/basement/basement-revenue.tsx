'use client'

// ─── Basement · Revenue desk ─────────────────────────────────────────────────
// Subscriptions (per-user plan control + ledger) and Payments (gateway
// config, live sync handshake, manual transactions). SUPER_ADMIN only.

import { useCallback, useEffect, useState } from 'react'
import { CreditCard, IndianRupee, Loader2, RefreshCw, Wallet, Zap } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  AdminFetch, ConfirmButton, DarkBadge, KpiCard, SectionTitle, fmtDate, fmtNum, fmtRelative, inputDarkCls, panelCls,
} from './basement-shared'

type SubUser = {
  id: string; email: string; name: string | null; accountStatus: string
  subscriptionTier: string | null; subscriptionStatus: string | null
  subscriptionPlan: string | null; subscriptionEnd: string | null
  active: boolean; _count: { subscriptions: number }
}

type LedgerRow = {
  id: string; plan: string; tier: string; amount: number; gst: number; total: number
  currency: string; status: string; startDate: string; endDate: string
  paymentMethod: string | null; createdAt: string
  user: { email: string; name: string | null }
}

type Summary = {
  totalUsers: number; activeCount: number; premiumCount: number; plusCount: number
  trialCount: number; mrr: number; revenueTotal: number
}

type GatewayConfig = {
  id: string; gateway: string; displayName: string; apiKey: string | null; apiSecret: string | null
  merchantId: string | null; webhookSecret: string | null; webhookUrl: string | null
  paymentLinkUrl: string | null; successUrl: string | null; failureUrl: string | null
  mode: string; active: boolean; currency: string
  lastSyncedAt: string | null; lastSyncStatus: string | null; lastSyncMessage: string | null
}

type Txn = {
  id: string; txnId: string | null; userEmail: string | null; userName: string | null
  amount: number; currency: string; status: string; method: string | null
  gateway: string | null; description: string | null; createdAt: string
}

type PaySummary = { capturedTotal: number; capturedCount: number; refundedTotal: number; refundedCount: number; txnCount: number }

export function BasementRevenue({ adminFetch }: { adminFetch: AdminFetch }) {
  const [view, setView] = useState<'subs' | 'payments'>('subs')

  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-1.5">
        {(['subs', 'payments'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              view === v ? 'border border-amber-400/30 bg-amber-400/10 text-amber-300' : 'text-zinc-500 hover:text-zinc-300'
            }`}>
            {v === 'subs' ? 'Subscriptions' : 'Payments & Gateway'}
          </button>
        ))}
      </div>
      {view === 'subs' ? <SubsDesk adminFetch={adminFetch} /> : <PaymentsDesk adminFetch={adminFetch} />}
    </div>
  )
}

// ═══ Subscriptions ═══════════════════════════════════════════════════════════
function SubsDesk({ adminFetch }: { adminFetch: AdminFetch }) {
  const [users, setUsers] = useState<SubUser[]>([])
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminFetch<{ users: SubUser[]; ledger: LedgerRow[]; summary: Summary }>('/api/admin/subscriptions')
      setUsers(data.users); setLedger(data.ledger); setSummary(data.summary)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load subscriptions')
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => { void load() }, [load])

  const act = async (userId: string, body: Record<string, unknown>, label: string) => {
    setBusyId(userId)
    try {
      const res = await adminFetch<{ message: string }>('/api/admin/subscriptions', { method: 'PATCH', body: JSON.stringify({ userId, ...body }) })
      toast.success(res.message || label)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = users.filter((u) =>
    !q || u.email.toLowerCase().includes(q.toLowerCase()) || (u.name ?? '').toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="total users" value={summary ? fmtNum(summary.totalUsers) : '…'} />
        <KpiCard label="active subs" value={summary ? fmtNum(summary.activeCount) : '…'} tone="emerald" />
        <KpiCard label="premium" value={summary ? fmtNum(summary.premiumCount) : '…'} tone="gold" />
        <KpiCard label="plus" value={summary ? fmtNum(summary.plusCount) : '…'} tone="gold" />
        <KpiCard label="≈ MRR" value={summary ? `₹${fmtNum(summary.mrr)}` : '…'} tone="emerald" icon={<IndianRupee className="h-3.5 w-3.5" />} />
        <KpiCard label="lifetime rev" value={summary ? `₹${fmtNum(summary.revenueTotal)}` : '…'} tone="gold" />
      </div>

      {/* Plan control */}
      <div className={panelCls + ' p-4'}>
        <SectionTitle>Plan control</SectionTitle>
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            <span>user</span><span>actions</span>
          </div>
          {loading && users.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading customers…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No users match.</p>
          ) : (
            filtered.map((u) => (
              <div key={u.id} className="rounded-lg bg-white/[0.03] px-2.5 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-zinc-200">{u.name ?? '—'} <span className="font-mono text-[10px] text-zinc-600">{u.email}</span></p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-zinc-500">
                      {u.subscriptionTier ? <DarkBadge tone={u.active ? 'gold' : 'zinc'}>{u.subscriptionTier}</DarkBadge> : <DarkBadge>free</DarkBadge>}
                      <span>{u.subscriptionStatus ?? 'none'}</span>
                      {u.subscriptionPlan && <span>· {u.subscriptionPlan}</span>}
                      {u.subscriptionEnd && <span>· till {fmtDate(u.subscriptionEnd)}</span>}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="outline" disabled={busyId === u.id}
                      onClick={() => void act(u.id, { action: 'set_plan', tier: 'premium', plan: 'monthly' }, 'premium monthly')}
                      className="h-7 border-amber-400/30 bg-amber-400/10 px-2 text-[11px] text-amber-300 hover:bg-amber-400/20">
                      <Zap className="h-3 w-3" /> Premium·mo
                    </Button>
                    <Button size="sm" variant="outline" disabled={busyId === u.id}
                      onClick={() => void act(u.id, { action: 'set_plan', tier: 'plus', plan: 'yearly' }, 'plus yearly')}
                      className="h-7 border-amber-400/30 bg-amber-400/10 px-2 text-[11px] text-amber-300 hover:bg-amber-400/20">
                      Plus·yr
                    </Button>
                    <Button size="sm" variant="outline" disabled={busyId === u.id}
                      onClick={() => void act(u.id, { action: 'extend', months: 1 }, 'extended')}
                      className="h-7 border-emerald-400/30 bg-emerald-400/10 px-2 text-[11px] text-emerald-300 hover:bg-emerald-400/20">
                      +1mo
                    </Button>
                    <Button size="sm" variant="outline" disabled={busyId === u.id}
                      onClick={() => void act(u.id, { action: 'grant_trial' }, 'trial granted')}
                      className="h-7 border-white/15 bg-white/[0.04] px-2 text-[11px] text-zinc-300 hover:bg-white/10">
                      Trial 7d
                    </Button>
                    <ConfirmButton disabled={busyId === u.id} onConfirm={() => act(u.id, { action: 'cancel' }, 'cancelled')}>
                      Cancel
                    </ConfirmButton>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Ledger */}
      <div className={panelCls + ' p-4'}>
        <SectionTitle icon={<CreditCard className="h-3 w-3" />}>Subscription ledger (latest 100)</SectionTitle>
        {ledger.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-600">No billing records yet — grants will appear here.</p>
        ) : (
          <div className="space-y-1">
            {ledger.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                  {r.user.name ?? r.user.email} <span className="font-mono text-[10px] text-zinc-600">{r.tier}/{r.plan}</span>
                </span>
                <span className="font-mono text-[11px] tabular-nums text-amber-300">₹{fmtNum(r.total)}</span>
                <DarkBadge tone={r.status === 'active' ? 'emerald' : r.status === 'cancelled' ? 'rose' : 'zinc'}>{r.status}</DarkBadge>
                <span className="font-mono text-[10px] text-zinc-600">{fmtDate(r.endDate)} · {r.paymentMethod ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══ Payments & Gateway ══════════════════════════════════════════════════════
function PaymentsDesk({ adminFetch }: { adminFetch: AdminFetch }) {
  const [config, setConfig] = useState<GatewayConfig | null>(null)
  const [txns, setTxns] = useState<Txn[]>([])
  const [summary, setSummary] = useState<PaySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)

  // form fields
  const [gateway, setGateway] = useState('razorpay')
  const [mode, setMode] = useState('test')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [paymentLinkUrl, setPaymentLinkUrl] = useState('')
  const [successUrl, setSuccessUrl] = useState('')
  const [failureUrl, setFailureUrl] = useState('')

  // manual txn
  const [mEmail, setMEmail] = useState('')
  const [mAmount, setMAmount] = useState('')
  const [mNote, setMNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminFetch<{ config: GatewayConfig | null; transactions: Txn[]; summary: PaySummary }>('/api/admin/payments')
      setConfig(data.config); setTxns(data.transactions); setSummary(data.summary)
      if (data.config) {
        setGateway(data.config.gateway); setMode(data.config.mode); setCurrency(data.config.currency)
        setPaymentLinkUrl(data.config.paymentLinkUrl ?? ''); setSuccessUrl(data.config.successUrl ?? ''); setFailureUrl(data.config.failureUrl ?? '')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load payments')
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => { void load() }, [load])

  const saveConfig = async () => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = { gateway, mode, currency, paymentLinkUrl, successUrl, failureUrl }
      if (apiKey) body.apiKey = apiKey
      if (apiSecret) body.apiSecret = apiSecret
      const data = await adminFetch<{ config: GatewayConfig }>('/api/admin/payments', { method: 'PUT', body: JSON.stringify(body) })
      setConfig(data.config)
      setApiKey(''); setApiSecret('')
      toast.success('Gateway config saved')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const syncGateway = async () => {
    setSyncing(true)
    try {
      const data = await adminFetch<{ sync: { ok: boolean; message: string } }>('/api/admin/payments?sync=1')
      if (data.sync.ok) toast.success(data.sync.message)
      else toast.error(data.sync.message)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const recordTxn = async () => {
    if (!mEmail.trim() || !Number(mAmount)) {
      toast.error('Customer email and amount are required.')
      return
    }
    try {
      await adminFetch('/api/admin/payments', {
        method: 'POST',
        body: JSON.stringify({ userEmail: mEmail, amount: Number(mAmount), description: mNote || undefined, status: 'captured', method: 'manual' }),
      })
      toast.success('Transaction recorded')
      setMEmail(''); setMAmount(''); setMNote('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Record failed')
    }
  }

  const markTxn = async (id: string, status: string) => {
    try {
      await adminFetch('/api/admin/payments', { method: 'PATCH', body: JSON.stringify({ id, status }) })
      toast.success(`Marked ${status}`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <KpiCard label="captured" value={summary ? `₹${fmtNum(summary.capturedTotal)}` : '…'} tone="emerald" icon={<Wallet className="h-3.5 w-3.5" />} />
        <KpiCard label="successful txns" value={summary ? fmtNum(summary.capturedCount) : '…'} />
        <KpiCard label="refunded" value={summary ? `₹${fmtNum(summary.refundedTotal)}` : '…'} tone="rose" />
        <KpiCard label="ledger rows" value={summary ? fmtNum(summary.txnCount) : '…'} />
      </div>

      {/* Gateway config */}
      <div className={panelCls + ' p-4'}>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle icon={<Zap className="h-3 w-3 text-amber-300" />}>Payment gateway</SectionTitle>
          {config?.lastSyncedAt && (
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500">
              last sync {fmtRelative(config.lastSyncedAt)}
              <DarkBadge tone={config.lastSyncStatus === 'success' ? 'emerald' : 'danger'}>{config.lastSyncStatus ?? 'unknown'}</DarkBadge>
            </span>
          )}
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Gateway</label>
            <Select value={gateway} onValueChange={setGateway}>
              <SelectTrigger className={`w-full ${inputDarkCls}`} aria-label="Gateway"><SelectValue /></SelectTrigger>
              <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
                <SelectItem value="razorpay">Razorpay</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="cashfree">Cashfree</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Mode</label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className={`w-full ${inputDarkCls}`} aria-label="Mode"><SelectValue /></SelectTrigger>
              <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
                <SelectItem value="test">test</SelectItem>
                <SelectItem value="live">live</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              Key ID {config?.apiKey && <span className="text-zinc-600 normal-case">(saved: {config.apiKey})</span>}
            </label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="rzp_test_…" className={inputDarkCls} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              Key Secret {config?.apiSecret && <span className="text-zinc-600 normal-case">(saved: {config.apiSecret})</span>}
            </label>
            <Input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="••••••••" className={inputDarkCls} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Payment link URL</label>
            <Input value={paymentLinkUrl} onChange={(e) => setPaymentLinkUrl(e.target.value)} placeholder="https://rzp.io/l/…" className={inputDarkCls} />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Currency</label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} className={inputDarkCls} />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Success URL</label>
            <Input value={successUrl} onChange={(e) => setSuccessUrl(e.target.value)} placeholder="/subscription/success" className={inputDarkCls} />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Failure URL</label>
            <Input value={failureUrl} onChange={(e) => setFailureUrl(e.target.value)} placeholder="/subscription/failed" className={inputDarkCls} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void saveConfig()} disabled={saving}
            className="h-8 bg-amber-400 font-semibold text-[#0a0810] hover:bg-amber-300">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save config
          </Button>
          <Button size="sm" variant="outline" onClick={() => void syncGateway()} disabled={syncing}
            className="h-8 border-white/15 bg-transparent text-zinc-300 hover:bg-white/5">
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Sync / test handshake
          </Button>
          {config && <DarkBadge tone={config.active ? 'emerald' : 'zinc'}>{config.active ? 'active' : 'inactive'} · {config.mode}</DarkBadge>}
        </div>
        {config?.lastSyncMessage && (
          <p className={`mt-2 font-mono text-[10px] ${config.lastSyncStatus === 'success' ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>{config.lastSyncMessage}</p>
        )}
      </div>

      {/* Manual transaction */}
      <div className={panelCls + ' p-4'}>
        <SectionTitle>Record a transaction (UPI / bank / cash)</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-[1.4fr_0.6fr_1.4fr_auto]">
          <Input value={mEmail} onChange={(e) => setMEmail(e.target.value)} placeholder="customer@email.com" className={inputDarkCls} />
          <Input value={mAmount} onChange={(e) => setMAmount(e.target.value)} placeholder="₹ amount" inputMode="decimal" className={inputDarkCls} />
          <Input value={mNote} onChange={(e) => setMNote(e.target.value)} placeholder="note (plan, invoice…)" className={inputDarkCls} />
          <Button size="sm" onClick={() => void recordTxn()} className="h-9 bg-amber-400 font-semibold text-[#0a0810] hover:bg-amber-300">Record</Button>
        </div>
      </div>

      {/* Transactions */}
      <div className={panelCls + ' p-4'}>
        <SectionTitle>Transactions (latest 100)</SectionTitle>
        {loading && txns.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Opening ledger…</p>
        ) : txns.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-600">No transactions yet — record one above or sync your gateway.</p>
        ) : (
          <div className="space-y-1">
            {txns.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                  {t.userName ?? '—'} <span className="font-mono text-[10px] text-zinc-600">{t.userEmail}</span>
                  {t.description && <span className="text-zinc-600"> · {t.description}</span>}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-amber-300">{t.currency} {fmtNum(t.amount)}</span>
                <DarkBadge tone={['captured', 'paid', 'success'].includes(t.status) ? 'emerald' : t.status === 'refunded' ? 'rose' : t.status === 'failed' ? 'danger' : 'zinc'}>{t.status}</DarkBadge>
                <span className="font-mono text-[10px] text-zinc-600">{t.gateway ?? '—'} · {t.method ?? '—'} · {fmtRelative(t.createdAt)}</span>
                {!['refunded', 'failed'].includes(t.status) && (
                  <ConfirmButton onConfirm={() => markTxn(t.id, 'refunded')} confirmLabel="Refund?">Refund</ConfirmButton>
                )}
                {t.status === 'created' && (
                  <Button size="sm" variant="outline" onClick={() => void markTxn(t.id, 'captured')}
                    className="h-7 border-emerald-400/30 bg-emerald-400/10 px-2 text-[11px] text-emerald-300 hover:bg-emerald-400/20">
                    Mark captured
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
