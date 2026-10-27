// Drobné pomocníky pro stavbu DOMu bez frameworku.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag)
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue
      if (k === 'class') el.className = v
      else if (k === 'html') el.innerHTML = v
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v)
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v)
      else if (v === true) el.setAttribute(k, '')
      else el.setAttribute(k, v)
    }
  }
  append(el, children)
  return el
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue
    if (Array.isArray(c)) append(el, c)
    else el.append(c instanceof Node ? c : String(c))
  }
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

// Text s `inline kódem` v backtickách -> HTML.
export function inlineCode(text) {
  return esc(text).replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove()
  return el
}

export function nav(title, { back = '#/', backLabel = 'Zpět', right = null } = {}) {
  return h('header', { class: 'nav' },
    back ? h('a', { class: 'back', href: back }, backLabel) : h('span'),
    h('b', null, title),
    h('span', { class: 'right' }, right ?? ''))
}

export function row({ href, onclick, icon, iconColor, title, sub, det, done, go = true, cls = '' }) {
  const tag = href ? 'a' : onclick ? 'button' : 'div'
  return h(tag, { class: `row ${icon ? 'with-icon' : ''} ${cls}`, href, onclick, type: tag === 'button' ? 'button' : null },
    icon ? h('span', { class: 'ic', style: { background: iconColor } }, icon) : null,
    h('span', { class: 'txt' }, title, sub ? h('small', null, sub) : null),
    det != null ? h('span', { class: 'det' }, det) : null,
    done ? h('span', { class: 'done', 'aria-label': 'hotovo' }, '✓') : null,
    (href || onclick) && go ? h('span', { class: 'go' }, '›') : null)
}

// Deterministický generátor náhodných čísel (mulberry32).
export function rngFrom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function newSeed() {
  return (Math.random() * 2 ** 32) >>> 0
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Jako Element.append, ale rozbalí pole a přeskočí null/false.
export function add(el, ...children) {
  append(el, children)
  return el
}
