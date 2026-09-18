import webpush from 'web-push'
import { db } from '@/lib/db'

// ─── Web Push (VAPID) configuration ──────────────────────────────────────────
// Keys are generated once (`bunx web-push generate-vapid-keys`) and stored in
// .env — no external service account is needed. The public key is exposed to
// the browser via NEXT_PUBLIC_VAPID_PUBLIC_KEY for pushManager.subscribe().

let configured = false

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PRIVATE_KEY &&
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  )
}

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null
}

function ensureConfigured() {
  if (configured) return
  if (!isPushConfigured()) {
    throw new Error('Push notifications are not configured (missing VAPID keys)')
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:hello@chandracycle.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  configured = true
}

export interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
  type?: string
}

/**
 * Send a push notification to every subscription belonging to a user.
 * Dead subscriptions (404/410 from the push service) are pruned so the
 * table stays clean. Returns per-outcome counts so callers can give
 * accurate feedback (no subs vs. failed sends are different problems).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; pruned: number; failed: number; total: number }> {
  if (!isPushConfigured()) return { sent: 0, pruned: 0, failed: 0, total: 0 }
  ensureConfigured()

  const subs = await db.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) return { sent: 0, pruned: 0, failed: 0, total: 0 }

  let sent = 0
  let pruned = 0
  let failed = 0
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        )
        sent++
      } catch (err) {
        const statusCode =
          typeof err === 'object' && err !== null && 'statusCode' in err
            ? (err as { statusCode?: number }).statusCode
            : undefined
        if (statusCode === 404 || statusCode === 410) {
          await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
          pruned++
        } else {
          failed++
          console.error('Push send failed:', statusCode, err)
        }
      }
    })
  )

  return { sent, pruned, failed, total: subs.length }
}
