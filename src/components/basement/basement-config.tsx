'use client'

// ─── Basement · App config ───────────────────────────────────────────────────
// Site-wide feature flags & messaging, saved to the SiteSetting KV store and
// enforced by the public content API + app shell. SUPER_ADMIN only.

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Save, Settings2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { AdminFetch, DarkBadge, SectionTitle, inputDarkCls, panelCls } from './basement-shared'

type Setting = { id: string; key: string; value: string }

// Flag metadata: label + what it does, rendered as a toggle row.
const KNOWN_FLAGS: { key: string; label: string; hint: string; on: string; off: string }[] = [
  { key: 'ads_enabled', label: 'Ads', hint: 'Show HQ-managed ad campaigns inside the app', on: 'on', off: 'off' },
  { key: 'news_enabled', label: 'News feed', hint: 'Show the newsroom feed inside the app', on: 'on', off: 'off' },
  { key: 'maintenance_mode', label: 'Maintenance mode', hint: 'Show a maintenance banner to every user', on: 'on', off: 'off' },
  { key: 'community_enabled', label: 'Community', hint: 'Community module availability', on: 'on', off: 'off' },
  { key: 'ai_chat_enabled', label: 'AI coach', hint: 'AI health chat availability', on: 'on', off: 'off' },
]

export function BasementConfig({ adminFetch }: { adminFetch: AdminFetch }) {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [maintenanceMsg, setMaintenanceMsg] = useState('')
  const [newKey, setNewKey] = useState('')
  const [newVal, setNewVal] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminFetch<{ settings: Setting[] }>('/api/admin/settings')
      setSettings(data.settings)
      const msg = data.settings.find((s) => s.key === 'maintenance_message')
      if (msg) setMaintenanceMsg(msg.value)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => { void load() }, [load])

  const valueOf = (key: string) => settings.find((s) => s.key === key)?.value ?? ''

  const save = async (entries: Record<string, string>) => {
    setSaving(true)
    try {
      const data = await adminFetch<{ changed: string[] }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ entries }),
      })
      toast.success(`Saved: ${data.changed.join(', ')}`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const toggle = (key: string, current: string) => {
    void save({ [key]: current === 'on' ? 'off' : 'on' })
  }

  const addCustom = async () => {
    if (!newKey.trim()) {
      toast.error('Setting key is required.')
      return
    }
    await save({ [newKey.trim()]: newVal })
    setNewKey(''); setNewVal('')
  }

  const customSettings = settings.filter((s) => !KNOWN_FLAGS.some((f) => f.key === s.key) && s.key !== 'maintenance_message')

  return (
    <div className="space-y-3.5">
      <div className={panelCls + ' p-4'}>
        <SectionTitle icon={<Settings2 className="h-3 w-3" />}>Feature flags — live app control</SectionTitle>
        {loading && settings.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading config…</p>
        ) : (
          <div className="space-y-1.5">
            {KNOWN_FLAGS.map((f) => {
              const value = valueOf(f.key) || 'on'
              const on = value === 'on'
              return (
                <div key={f.key} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-zinc-200">{f.label}</span>
                    <span className="block text-[11px] text-zinc-500">{f.hint}</span>
                  </span>
                  <DarkBadge tone={on ? 'emerald' : 'zinc'}>{on ? 'live' : 'hidden'}</DarkBadge>
                  <button
                    onClick={() => toggle(f.key, value)}
                    disabled={saving}
                    role="switch"
                    aria-checked={on}
                    aria-label={`Toggle ${f.label}`}
                    className={`relative h-5.5 w-10 shrink-0 rounded-full border transition-colors ${
                      on ? 'border-amber-400/50 bg-amber-400/25' : 'border-white/15 bg-white/[0.06]'
                    }`}
                  >
                    <span className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all ${
                      on ? 'left-[calc(100%-18px)] bg-amber-300' : 'left-0.5 bg-zinc-500'
                    }`} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className={panelCls + ' p-4'}>
        <SectionTitle>Maintenance message</SectionTitle>
        <div className="flex gap-2">
          <Input value={maintenanceMsg} onChange={(e) => setMaintenanceMsg(e.target.value)}
            placeholder="We are upgrading Nuvia — back shortly." maxLength={300} className={inputDarkCls} />
          <Button size="sm" onClick={() => void save({ maintenance_message: maintenanceMsg })} disabled={saving}
            className="h-9 shrink-0 bg-amber-400 font-semibold text-[#0a0810] hover:bg-amber-300">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-600">Shown inside the maintenance banner when maintenance mode is ON.</p>
      </div>

      <div className={panelCls + ' p-4'}>
        <SectionTitle>Advanced settings</SectionTitle>
        {customSettings.length > 0 && (
          <div className="mb-2.5 space-y-1">
            {customSettings.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                <span className="font-mono text-[11px] text-amber-300/80">{s.key}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-400">{s.value || '—'}</span>
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
          <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="setting_key" className={inputDarkCls} />
          <Input value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder="value" className={inputDarkCls} />
          <Button size="sm" onClick={() => void addCustom()} className="h-9 bg-amber-400 font-semibold text-[#0a0810] hover:bg-amber-300">
            <Plus className="h-3.5 w-3.5" /> Upsert
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-600">Any key/value pair — readable by the app via SiteSetting. Audit-logged on change.</p>
      </div>
    </div>
  )
}
