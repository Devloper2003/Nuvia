// ─── ChandraCycle reminder-scheduler mini-service ────────────────────────────
//
// Purpose: period reminders must arrive even when the app is closed. The
// Next.js app only checks reminders when a client mounts the notification
// panel — this service closes that gap by pinging the server-side sweep
// endpoint (/api/cron/reminders) on a fixed schedule. The sweep fans out
// web-push notifications to every subscribed device.
//
// Port: 3031 (independent of the Next dev server on 3000)
//
// Endpoints (observability):
//   GET /health   → { ok, uptimeSec, intervalMin, runs, lastRun, lastError }
//   POST /run-now → trigger a sweep immediately (manual/testing)
//
// Schedule: SWEEP_INTERVAL_MIN (default 15) minutes, plus one initial sweep
// shortly after boot (grace period while the Next server compiles).

const PORT = 3031
const APP_BASE = process.env.APP_BASE || 'http://localhost:3000'
const INTERVAL_MIN = Number(process.env.SWEEP_INTERVAL_MIN || 15)
const CRON_SECRET = process.env.CRON_SECRET || ''

interface SweepSummary {
  at: string
  swept?: number
  triggered?: number
  cooldown?: number
  notDue?: number
  noCycleData?: number
  errors?: number
  pushesSent?: number
  ok?: boolean
}

const state = {
  startedAt: Date.now(),
  runs: 0,
  lastRun: null as SweepSummary | null,
  lastError: null as string | null,
  running: false,
}

async function runSweep(trigger: string): Promise<SweepSummary | null> {
  if (state.running) return state.lastRun
  state.running = true
  try {
    const res = await fetch(`${APP_BASE}/api/cron/reminders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(CRON_SECRET ? { 'x-cron-secret': CRON_SECRET } : {}),
      },
      body: JSON.stringify({ trigger }),
    })
    const data = (await res.json()) as SweepSummary
    if (!res.ok) throw new Error(`sweep HTTP ${res.status}: ${JSON.stringify(data)}`)
    state.runs++
    state.lastRun = { at: new Date().toISOString(), ...data }
    state.lastError = null
    console.log(
      `[reminder-scheduler] sweep ok — swept=${data.swept} triggered=${data.triggered} cooldown=${data.cooldown} notDue=${data.notDue} pushes=${data.pushesSent}`
    )
    return state.lastRun
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err)
    console.error('[reminder-scheduler] sweep failed:', state.lastError)
    return null
  } finally {
    state.running = false
  }
}

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/health') {
      return jsonRes({
        ok: true,
        service: 'reminder-scheduler',
        uptimeSec: Math.round((Date.now() - state.startedAt) / 1000),
        intervalMin: INTERVAL_MIN,
        appBase: APP_BASE,
        runs: state.runs,
        running: state.running,
        lastRun: state.lastRun,
        lastError: state.lastError,
      })
    }
    if (url.pathname === '/run-now' && req.method === 'POST') {
      const result = await runSweep('manual')
      return jsonRes({ ok: Boolean(result), result })
    }
    return jsonRes({ error: 'Not found' }, 404)
  },
})

// Initial sweep after a grace period (Next dev server compiles routes lazily;
// the first ping may hit a cold compile — the sweep endpoint retries cheaply).
setTimeout(() => void runSweep('boot'), 20_000)

// Fixed-interval sweep.
setInterval(() => void runSweep('interval'), INTERVAL_MIN * 60_000)

console.log(`[reminder-scheduler] listening on :${PORT} — sweeping ${APP_BASE}/api/cron/reminders every ${INTERVAL_MIN}min`)
