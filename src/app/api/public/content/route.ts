import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─── GET /api/public/content ─────────────────────────────────────────────────
// Public marketing surface: active ad campaigns + published news + active
// announcement. Governed by HQ feature flags (ads_enabled / news_enabled) so
// the basement config tab controls what the app actually shows.
export async function GET(_request: NextRequest) {
  try {
    const settings = await db.siteSetting.findMany({
      where: { key: { in: ['ads_enabled', 'news_enabled', 'maintenance_mode', 'maintenance_message'] } },
    })
    const flags = new Map(settings.map((s) => [s.key, s.value]))
    const adsOn = flags.get('ads_enabled') !== 'off'
    const newsOn = flags.get('news_enabled') !== 'off'
    const maintenance = flags.get('maintenance_mode') === 'on'

    const now = new Date()

    const [campaigns, news, announcements] = await Promise.all([
      adsOn
        ? db.campaign.findMany({
            where: { status: 'active' },
            orderBy: { updatedAt: 'desc' },
            take: 10,
          })
        : Promise.resolve([] as { id: string; type: string; title: string; message: string; ctaText: string | null; ctaLink: string | null; imageUrl: string | null; position: string; audience: string; startDate: Date | null; endDate: Date | null }[]),
      newsOn
        ? db.newsPost.findMany({
            where: { published: true },
            orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
            take: 6,
            select: { id: true, title: true, excerpt: true, category: true, pinned: true, publishedAt: true },
          })
        : Promise.resolve([]),
      db.announcement.findMany({
        where: { active: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }),
    ])

    // Date-window filtering happens here (tiny lists, no query complexity).
    const visibleCampaigns = campaigns
      .filter((c) => (!c.startDate || c.startDate <= now) && (!c.endDate || c.endDate >= now))
      .slice(0, 5)
      .map((c) => ({
        id: c.id, type: c.type, title: c.title, message: c.message,
        ctaText: c.ctaText, ctaLink: c.ctaLink, imageUrl: c.imageUrl,
        position: c.position, audience: c.audience,
      }))

    return NextResponse.json({
      ads: visibleCampaigns,
      news,
      announcement: announcements[0] ?? null,
      maintenance,
      maintenanceMessage: flags.get('maintenance_message') ?? null,
      flags: { ads: adsOn, news: newsOn },
    })
  } catch (error) {
    console.error('Public content error:', error)
    return NextResponse.json({ ads: [], news: [], announcement: null, maintenance: false, maintenanceMessage: null, flags: { ads: false, news: false } })
  }
}
