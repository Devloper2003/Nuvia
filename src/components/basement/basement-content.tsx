'use client'

// ─── Basement · Content studio ───────────────────────────────────────────────
// Newsroom (publish articles into the app) + Ad campaigns (banners/promos
// with placement, audience, budget & engagement stats). SUPER_ADMIN only.

import { useCallback, useEffect, useState } from 'react'
import { Megaphone, Newspaper, Pin, Loader2, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  AdminFetch, ConfirmButton, DarkBadge, SectionTitle, fmtDate, fmtNum, fmtRelative, inputDarkCls, panelCls,
} from './basement-shared'

type NewsRow = {
  id: string; title: string; excerpt: string | null; body: string
  category: string; pinned: boolean; published: boolean
  publishedAt: string | null; authorName: string | null; createdAt: string
}

type CampaignRow = {
  id: string; name: string; type: string; title: string; message: string
  ctaText: string | null; ctaLink: string | null; position: string; audience: string
  status: string; budget: number | null; spent: number
  impressions: number; clicks: number; conversions: number
  startDate: string | null; endDate: string | null; createdAt: string
}

export function BasementContent({ adminFetch }: { adminFetch: AdminFetch }) {
  const [view, setView] = useState<'news' | 'ads'>('news')
  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-1.5">
        {(['news', 'ads'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              view === v ? 'border border-amber-400/30 bg-amber-400/10 text-amber-300' : 'text-zinc-500 hover:text-zinc-300'
            }`}>
            {v === 'news' ? 'Newsroom' : 'Ads & Campaigns'}
          </button>
        ))}
      </div>
      {view === 'news' ? <NewsDesk adminFetch={adminFetch} /> : <AdsDesk adminFetch={adminFetch} />}
    </div>
  )
}

// ═══ Newsroom ════════════════════════════════════════════════════════════════
function NewsDesk({ adminFetch }: { adminFetch: AdminFetch }) {
  const [posts, setPosts] = useState<NewsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('update')
  const [body, setBody] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminFetch<{ posts: NewsRow[] }>('/api/admin/news')
      setPosts(data.posts)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load news')
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => { void load() }, [load])

  const create = async (publish: boolean) => {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and body are required.')
      return
    }
    setBusy(true)
    try {
      await adminFetch('/api/admin/news', {
        method: 'POST',
        body: JSON.stringify({ title, body, category, publish }),
      })
      toast.success(publish ? 'Published to the app' : 'Draft saved')
      setTitle(''); setBody('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  const act = async (id: string, action: string) => {
    try {
      await adminFetch('/api/admin/news', { method: 'PATCH', body: JSON.stringify({ id, action }) })
      toast.success(`Post ${action.replace('un', '')}… done`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    }
  }

  const remove = async (id: string) => {
    try {
      await adminFetch(`/api/admin/news?id=${id}`, { method: 'DELETE' })
      toast.success('Post deleted')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="space-y-3.5">
      <div className={panelCls + ' p-4'}>
        <SectionTitle icon={<Newspaper className="h-3 w-3" />}>Write a post</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-[1.6fr_1fr]">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Headline…" maxLength={200} className={inputDarkCls} />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className={`w-full ${inputDarkCls}`} aria-label="Category"><SelectValue /></SelectTrigger>
            <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
              <SelectItem value="update">update</SelectItem>
              <SelectItem value="feature">feature</SelectItem>
              <SelectItem value="health">health</SelectItem>
              <SelectItem value="company">company</SelectItem>
              <SelectItem value="press">press</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={20000}
          placeholder="What's happening inside Nuvia?" className={`mt-2 ${inputDarkCls}`} />
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void create(true)} disabled={busy}
            className="h-8 bg-amber-400 font-semibold text-[#0a0810] hover:bg-amber-300">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Publish now
          </Button>
          <Button size="sm" variant="outline" onClick={() => void create(false)} disabled={busy}
            className="h-8 border-white/15 bg-transparent text-zinc-300 hover:bg-white/5">
            Save draft
          </Button>
        </div>
      </div>

      <div className={panelCls + ' p-4'}>
        <SectionTitle>Posts ({posts.length})</SectionTitle>
        {loading && posts.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading newsroom…</p>
        ) : posts.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-600">Nothing published yet — write the first post above.</p>
        ) : (
          <div className="space-y-1.5">
            {posts.map((p) => (
              <div key={p.id} className="rounded-lg bg-white/[0.03] px-2.5 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {p.pinned && <Pin className="h-3 w-3 text-amber-300" />}
                  <span className="min-w-0 flex-1 truncate text-xs text-zinc-200">{p.title}</span>
                  <DarkBadge tone="zinc">{p.category}</DarkBadge>
                  <DarkBadge tone={p.published ? 'emerald' : 'zinc'}>{p.published ? 'live' : 'draft'}</DarkBadge>
                  <span className="font-mono text-[10px] text-zinc-600">{p.published ? fmtDate(p.publishedAt) : fmtDate(p.createdAt)} · {p.authorName ?? '—'}</span>
                </div>
                {p.excerpt && <p className="mt-1 truncate text-[11px] text-zinc-500">{p.excerpt}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => void act(p.id, p.published ? 'unpublish' : 'publish')}
                    className={`h-6.5 px-2 py-0 text-[11px] ${p.published ? 'border-white/15 bg-transparent text-zinc-400 hover:bg-white/5' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20'}`}>
                    {p.published ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void act(p.id, p.pinned ? 'unpin' : 'pin')}
                    className="h-6.5 border-white/15 bg-transparent px-2 py-0 text-[11px] text-zinc-400 hover:bg-white/5">
                    {p.pinned ? 'Unpin' : 'Pin'}
                  </Button>
                  <ConfirmButton onConfirm={() => remove(p.id)} className="h-6.5 py-0">
                    <Trash2 className="h-3 w-3" /> Delete
                  </ConfirmButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══ Ads & Campaigns ═════════════════════════════════════════════════════════
function AdsDesk({ adminFetch }: { adminFetch: AdminFetch }) {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [position, setPosition] = useState('top')
  const [audience, setAudience] = useState('all')
  const [ctaText, setCtaText] = useState('')
  const [ctaLink, setCtaLink] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminFetch<{ campaigns: CampaignRow[] }>('/api/admin/campaigns')
      setCampaigns(data.campaigns)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => { void load() }, [load])

  const create = async () => {
    if (!name.trim() || !title.trim() || !message.trim()) {
      toast.error('Name, title and message are required.')
      return
    }
    setBusy(true)
    try {
      await adminFetch('/api/admin/campaigns', {
        method: 'POST',
        body: JSON.stringify({ name, title, message, position, audience, ctaText: ctaText || undefined, ctaLink: ctaLink || undefined }),
      })
      toast.success('Campaign created (draft) — activate when ready')
      setName(''); setTitle(''); setMessage(''); setCtaText(''); setCtaLink('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  const act = async (id: string, action: string) => {
    try {
      await adminFetch('/api/admin/campaigns', { method: 'PATCH', body: JSON.stringify({ id, action }) })
      toast.success(`Campaign ${action}d`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    }
  }

  const remove = async (id: string) => {
    try {
      await adminFetch(`/api/admin/campaigns?id=${id}`, { method: 'DELETE' })
      toast.success('Campaign deleted')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const ctr = (c: CampaignRow) => (c.impressions > 0 ? `${((c.clicks / c.impressions) * 100).toFixed(1)}%` : '—')

  return (
    <div className="space-y-3.5">
      <div className={panelCls + ' p-4'}>
        <SectionTitle icon={<Megaphone className="h-3 w-3" />}>New campaign</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Internal name…" maxLength={120} className={inputDarkCls} />
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="User-facing title…" maxLength={160} className={inputDarkCls} />
          <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="User-facing message…" maxLength={500} className={inputDarkCls} />
          <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="CTA text (e.g. Explore)" maxLength={40} className={inputDarkCls} />
          <Input value={ctaLink} onChange={(e) => setCtaLink(e.target.value)} placeholder="CTA link (/premium)" className={inputDarkCls} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger className={`w-full ${inputDarkCls}`} aria-label="Position"><SelectValue /></SelectTrigger>
              <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
                <SelectItem value="top">top strip</SelectItem>
                <SelectItem value="feed">feed card</SelectItem>
                <SelectItem value="bottom">bottom</SelectItem>
                <SelectItem value="modal">modal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger className={`w-full ${inputDarkCls}`} aria-label="Audience"><SelectValue /></SelectTrigger>
              <SelectContent className="border-white/15 bg-[#14111f] text-zinc-200">
                <SelectItem value="all">all users</SelectItem>
                <SelectItem value="free">free only</SelectItem>
                <SelectItem value="premium">premium only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button size="sm" onClick={() => void create()} disabled={busy}
          className="mt-2.5 h-8 bg-amber-400 font-semibold text-[#0a0810] hover:bg-amber-300">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create campaign
        </Button>
      </div>

      <div className={panelCls + ' p-4'}>
        <SectionTitle>Campaigns ({campaigns.length})</SectionTitle>
        {loading && campaigns.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading campaigns…</p>
        ) : campaigns.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-600">No campaigns yet — live ads show up inside the app once activated.</p>
        ) : (
          <div className="space-y-1.5">
            {campaigns.map((c) => (
              <div key={c.id} className="rounded-lg bg-white/[0.03] px-2.5 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-zinc-200">
                    <span className="font-medium">{c.title}</span>
                    <span className="text-zinc-600"> · {c.name}</span>
                  </span>
                  <DarkBadge tone={c.status === 'active' ? 'emerald' : c.status === 'paused' ? 'rose' : 'zinc'}>{c.status}</DarkBadge>
                  <DarkBadge tone="zinc">{c.position}</DarkBadge>
                  <DarkBadge tone="gold">{c.audience}</DarkBadge>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {fmtNum(c.impressions)} impr · {fmtNum(c.clicks)} clicks · CTR {ctr(c)}
                    {c.budget ? ` · ₹${fmtNum(c.spent)}/₹${fmtNum(c.budget)}` : ''}
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-zinc-500">{c.message}{c.ctaText && ` → [${c.ctaText}]`}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {c.status !== 'active' && (
                    <Button size="sm" variant="outline" onClick={() => void act(c.id, 'activate')}
                      className="h-6.5 border-emerald-400/30 bg-emerald-400/10 px-2 py-0 text-[11px] text-emerald-300 hover:bg-emerald-400/20">
                      Activate
                    </Button>
                  )}
                  {c.status === 'active' && (
                    <Button size="sm" variant="outline" onClick={() => void act(c.id, 'pause')}
                      className="h-6.5 border-white/15 bg-transparent px-2 py-0 text-[11px] text-zinc-400 hover:bg-white/5">
                      Pause
                    </Button>
                  )}
                  {c.status !== 'completed' && (
                    <Button size="sm" variant="outline" onClick={() => void act(c.id, 'complete')}
                      className="h-6.5 border-white/15 bg-transparent px-2 py-0 text-[11px] text-zinc-400 hover:bg-white/5">
                      Complete
                    </Button>
                  )}
                  <ConfirmButton onConfirm={() => remove(c.id)} className="h-6.5 py-0">
                    <Trash2 className="h-3 w-3" /> Delete
                  </ConfirmButton>
                  <span className="ml-auto self-center font-mono text-[10px] text-zinc-600">created {fmtRelative(c.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
