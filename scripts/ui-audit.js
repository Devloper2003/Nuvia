// Nuvia comprehensive UI audit runner (agent-browser eval payload)
// Usage: agent-browser eval "$(cat scripts/ui-audit.js)" — audits CURRENT module.
// Caller switches module first, waits for render, then runs this.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vw = window.innerWidth, vh = window.innerHeight
  const doc = document.documentElement
  const issues = []

  // ── 1. find the main scroll container and scroll to bottom ──────────────
  const main = document.querySelector('main')
  let scroller = main
  while (scroller && scroller !== document.body) {
    const cs = getComputedStyle(scroller)
    if (/(auto|scroll)/.test(cs.overflowY) && scroller.scrollHeight > scroller.clientHeight + 2) break
    scroller = scroller.parentElement
  }
  if (scroller && scroller !== document.body) {
    scroller.scrollTop = scroller.scrollHeight // jump to bottom
    await sleep(350)
  } else {
    window.scrollTo(0, document.body.scrollHeight)
    await sleep(250)
  }

  const txtLen = main ? main.innerText.trim().length : 0

  // ── 2. document-level horizontal scroll ──────────────────────────────────
  if (doc.scrollWidth > vw + 1) issues.push(`H-SCROLL doc.scrollWidth=${doc.scrollWidth} vw=${vw}`)
  if (document.body.scrollWidth > vw + 1 && getComputedStyle(document.body).overflowX === 'visible')
    issues.push(`H-SCROLL body.scrollWidth=${document.body.scrollWidth} vw=${vw}`)

  // ── 3. element-level scan: clipped content + viewport pokes ─────────────
  const clipped = []
  const pokes = []
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META'])
  for (const el of document.querySelectorAll('body *')) {
    if (SKIP.has(el.tagName)) continue
    if (el.closest('[aria-hidden="true"]')) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0' || cs.pointerEvents === 'none') continue
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) continue
    if (cs.position === 'fixed') continue

    // walk to nearest clipping ancestor
    let p = el.parentElement, guard = 0
    let handledX = false
    while (p && guard++ < 25) {
      if (SKIP.has(p.tagName)) { p = p.parentElement; continue }
      const pcs = getComputedStyle(p)
      if (pcs.display === 'none') { p = p.parentElement; continue }
      const clX = pcs.overflowX, clY = pcs.overflowY
      if (clX !== 'visible' || clY !== 'visible') {
        const isView = p === document.documentElement || p === document.body
        if (!isView) {
          const pr = p.getBoundingClientRect()
          const scrollY = /(auto|scroll)/.test(clY) && p.scrollHeight > p.clientHeight + 2
          const scrollX = /(auto|scroll)/.test(clX) && p.scrollWidth > p.clientWidth + 2
          const cutB = r.bottom - pr.bottom, cutR = r.right - pr.right
          const cutT = pr.top - r.top, cutL = pr.left - r.left
          if (cutB > 12 && !scrollY) clipped.push({ t: el.tagName, c: String(el.className).slice(0, 90), cut: 'bottom+' + Math.round(cutB), by: p.tagName + '.' + String(p.className).slice(0, 70) })
          else if (cutT > 12 && !scrollY) clipped.push({ t: el.tagName, c: String(el.className).slice(0, 90), cut: 'top+' + Math.round(cutT), by: p.tagName + '.' + String(p.className).slice(0, 70) })
          if (cutR > 12 || cutL > 12) {
            if (scrollX) { handledX = true }
            else if (!scrollY) clipped.push({ t: el.tagName, c: String(el.className).slice(0, 90), cut: (cutR > 12 ? 'right+' + Math.round(cutR) : 'left+' + Math.round(cutL)), by: p.tagName + '.' + String(p.className).slice(0, 70) })
          }
        }
        break
      }
      p = p.parentElement
    }
    // poke beyond viewport with no scrollable-x ancestor → horizontal cut
    if (!handledX && r.right > vw + 2) {
      let anc = el.parentElement, g2 = 0, scrollable = false
      while (anc && g2++ < 25) {
        const acs = getComputedStyle(anc)
        if (/(auto|scroll)/.test(acs.overflowX)) { scrollable = true; break }
        if (anc === document.body) break
        anc = anc.parentElement
      }
      if (!scrollable) pokes.push({ t: el.tagName, c: String(el.className).slice(0, 90), right: Math.round(r.right), vw })
    }
  }

  // dedupe & trim
  const seen = new Set()
  const uniqClip = clipped.filter((x) => { const k = x.t + '|' + x.cut + '|' + x.by; if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 14)
  const seen2 = new Set()
  const uniqPoke = pokes.filter((x) => { const k = x.t + '|' + x.c.slice(0, 30); if (seen2.has(k)) return false; seen2.add(k); return true }).slice(0, 10)

  // ── 4. interactive elements below the fold that can't be scrolled to ────
  // (scroll container already at bottom — anything still fully below viewport
  //  bottom inside it is unreachable → misbehaving UI)
  let unreachable = 0
  if (scroller && scroller !== document.body) {
    const sr = scroller.getBoundingClientRect()
    for (const el of scroller.querySelectorAll('button, a, input, select, textarea, [role="button"], [role="tab"]')) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (!r.height) continue
      if (r.top > vh + 4) unreachable++
    }
  }

  // ── 5. occlusion: interactive elements covered by FIXED overlays ────────
  // (bottom-nav, FABs, sticky headers — the #1 mobile "UI misbehaving" cause)
  const occluded = []
  const fixedEls = []
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    if (cs.position === 'fixed' && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05) {
      const r = el.getBoundingClientRect()
      if (r.width > 40 && r.height > 20 && r.width < vw * 1.2) fixedEls.push({ el, r, cs })
    }
  }
  const interactives = main
    ? main.querySelectorAll('button:not([disabled]), a[href], [role="button"], [role="tab"]')
    : []
  for (const el of interactives) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || r.top < 0 || r.bottom > vh) continue // offscreen handled elsewhere
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const hit = document.elementFromPoint(cx, cy)
    if (!hit || hit === el || el.contains(hit) || hit.contains(el)) continue
    // is the top hit inside one of the fixed overlays while our el is not?
    const hitFixed = fixedEls.find((f) => f.el.contains(hit))
    if (hitFixed && !hitFixed.el.contains(el)) {
      occluded.push({
        t: el.tagName, label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
        by: (hitFixed.el.className && String(hitFixed.el.className).slice(0, 50)) || hitFixed.el.tagName,
        y: Math.round(cy),
      })
    }
  }

  // ── 6. truncated text without ellipsis (visually cut words) ──────────────
  const trunc = []
  for (const el of main ? main.querySelectorAll('h1,h2,h3,h4,p,span,div') : []) {
    if (el.children.length > 0) continue // leaf text nodes only
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const r = el.getBoundingClientRect()
    if (!r.width || r.top > vh || r.bottom < 0) continue
    const sw = el.scrollWidth, cw = el.clientWidth
    if (sw > cw + 6 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && cs.textOverflow !== 'ellipsis' && cs.whiteSpace === 'nowrap') {
      trunc.push({ txt: (el.textContent || '').trim().slice(0, 40), c: String(el.className).slice(0, 60) })
    }
  }

  // ── 7. quick layout sanity: main exists & non-empty ─────────────────────
  if (!main) issues.push('NO-MAIN')
  else if (txtLen < 10) issues.push('EMPTY-MODULE txtLen=' + txtLen)

  const result = { vw, vh, txtLen, issues, pokes: uniqPoke, clipped: uniqClip, unreachable, occluded: occluded.slice(0, 10), trunc: trunc.slice(0, 8) }
  window.__AUDIT_LAST__ = result
  return JSON.stringify(result)
})()
