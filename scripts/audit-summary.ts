// Summarize an audit JSONL file: per-module compact status line.
// Usage: bun scripts/audit-summary.ts <file>
import { readFileSync } from 'node:fs'
const file = process.argv[2]
const lines = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
for (const line of lines) {
  try {
    const rec = JSON.parse(line)
    let a = rec.audit
    if (typeof a === 'string') a = JSON.parse(a)
    const probs = []
    if (a.issues?.length) probs.push(...a.issues)
    if (a.pokes?.length) probs.push(`POKE x${a.pokes.length}`)
    if (a.clipped?.length) probs.push(`CLIP x${a.clipped.length}`)
    if (a.unreachable) probs.push(`UNREACH x${a.unreachable}`)
    if (a.occluded?.length) probs.push(`OCCLUDED x${a.occluded.length}`)
    if (a.trunc?.length) probs.push(`TRUNC x${a.trunc.length}`)
    console.log(`[${rec.module}] ${probs.length ? probs.join(' | ') : 'OK'}`)
    for (const p of a.pokes || []) console.log(`    poke: <${p.t}> .${p.c.slice(0, 60)} right=${p.right} vw=${a.vw}`)
    for (const c of a.clipped || []) console.log(`    clip: <${c.t}> ${c.cut} by ${c.by} :: .${c.c.slice(0, 60)}`)
    for (const o of a.occluded || []) console.log(`    occluded: <${o.t}> "${o.label}" y=${o.y} by ${o.by}`)
    for (const t of a.trunc || []) console.log(`    trunc: "${t.txt}" .${t.c.slice(0, 50)}`)
  } catch (e) {
    console.log(`[?] parse fail: ${String(e).slice(0, 80)}`)
  }
}
