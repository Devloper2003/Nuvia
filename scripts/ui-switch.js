// Switch to a module by its English nav label, wait for render, return ok.
// Works on mobile (More sheet) and desktop (sidebar). Replace __LABEL__.
(async () => {
  const LABEL = '__LABEL__'
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const matchBtn = (b) => {
    const al = b.getAttribute('aria-label')
    if (al && al.trim().toLowerCase() === LABEL.toLowerCase()) return true
    const tx = (b.textContent || '').trim().toLowerCase()
    return tx === LABEL.toLowerCase()
  }
  const isVisible = (b) => {
    const r = b.getBoundingClientRect()
    const cs = getComputedStyle(b)
    return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'
  }
  const all = [...document.querySelectorAll('button')]

  // Desktop: sidebar button first (visible sidebar)
  let target = all.find((b) => b.closest('aside') && matchBtn(b) && isVisible(b))
  if (target) {
    target.click()
    await sleep(750)
    return JSON.stringify({ ok: true, via: 'sidebar', switched: LABEL })
  }

  // Mobile: open More sheet, click item inside the dialog
  const moreBtn = all.find((b) => b.getAttribute('aria-label') === 'More' && isVisible(b))
  if (moreBtn) {
    moreBtn.click()
    await sleep(650)
    const dlg = [...document.querySelectorAll('[role="dialog"]')].reverse()[0]
    const scope = dlg ? [...dlg.querySelectorAll('button')] : []
    target = scope.find(matchBtn) || [...document.querySelectorAll('button')].find((b) => matchBtn(b) && isVisible(b))
    if (target) {
      target.click()
      await sleep(750)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await sleep(300)
      return JSON.stringify({ ok: true, via: 'sheet', switched: LABEL })
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await sleep(300)
    return JSON.stringify({ ok: false, err: 'no item ' + LABEL + ' in sheet' })
  }
  return JSON.stringify({ ok: false, err: 'no nav for ' + LABEL })
})()
