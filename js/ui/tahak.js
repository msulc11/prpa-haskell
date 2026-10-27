import { add, h, clear, nav, row, inlineCode, esc } from './dom.js'
import { codeView, newSession, shortError } from './hsx.js'
import { sendToConsole } from './konzole.js'

const load = () => import('../data/teorie.js').then(m => m.sections)

export async function tahakList(view) {
  const sections = await load()
  add(clear(view),
    nav('Tahák', { back: null }),
    h('p', { class: 'note', style: { marginTop: '16px' } }, 'Shrnutí ze cvičení. Příklady jde spustit přímo tady, nebo poslat do konzole.'),
    h('div', { class: 'group', style: { marginTop: '12px' } },
      sections.map(s => row({ href: `#/tahak/${encodeURIComponent(s.id)}`, title: s.title }))))
}

function exprLines(code) {
  return code.split('\n')
    .map(l => l.replace(/\s+--\s.*$/, '').trim())
    .filter(l => l && !l.startsWith('--'))
}

// Spustí ukázku v čisté session: u definic je načte a vyhodnotí `try`, u výrazů každý řádek.
function runBlock(b) {
  const s = newSession()
  const out = []
  let exprs
  if (b.kind === 'defs') {
    const r = s.load(b.code)
    if (!r.ok) return [{ expr: 'načtení', got: shortError(r.error), bad: true }]
    exprs = b.try ?? []
  } else exprs = exprLines(b.code)
  for (const e of exprs) {
    const r = s.eval(e)
    out.push({ expr: e, got: r.ok ? r.output : shortError(r.error), bad: !r.ok })
  }
  return out
}

function consolePayload(b) {
  if (b.kind === 'defs') return [b.code, ...(b.try ?? []).map(e => '> ' + e)].join('\n')
  return exprLines(b.code).map(l => '> ' + l).join('\n')
}

function block(b) {
  if (b.type === 'p') return h('p', { html: inlineCode(b.text) })
  if (b.type === 'code') {
    const v = codeView(b.code)
    if (!b.run) return v
    const results = h('div')
    const runBtn = h('button', { class: 'linkbtn', type: 'button' }, 'Spustit')
    runBtn.addEventListener('click', () => {
      const res = runBlock(b)
      add(clear(results), h('div', { class: 'code-view', style: { marginTop: '8px' } },
        res.length ? res.map(r => h('div', null,
          h('span', { style: { color: 'var(--muted)' } }, `${r.expr}  ⟹  `),
          h('span', { style: r.bad ? { color: 'var(--bad)' } : null }, r.got)))
          : h('span', { style: { color: 'var(--muted)' } }, 'Načteno, nic k vyhodnocení.')))
      runBtn.textContent = 'Spustit znovu'
    })
    return h('div', null, v, results, h('div', { class: 'runrow', style: { gap: '18px' } },
      h('button', { class: 'linkbtn', type: 'button', onclick: () => sendToConsole(consolePayload(b)) }, 'Do konzole'),
      runBtn))
  }
  if (b.type === 'table') {
    return h('table', null,
      b.head ? h('thead', null, h('tr', null, b.head.map(c => h('th', { html: inlineCode(c) })))) : null,
      h('tbody', null, b.rows.map(r => h('tr', null, r.map(c => h('td', { html: inlineCode(String(c)) }))))))
  }
  return h('p', null, esc(JSON.stringify(b)))
}

export async function tahakSection(view, rawId) {
  const sections = await load()
  const id = decodeURIComponent(rawId)
  const i = sections.findIndex(s => s.id === id)
  if (i < 0) { location.replace('#/tahak'); return }
  const s = sections[i]
  const next = sections[i + 1]
  add(clear(view),
    nav(s.title, { back: '#/tahak', backLabel: 'Tahák' }),
    h('div', { class: 'prose' }, s.blocks.map(block)),
    next ? h('div', { class: 'group', style: { marginTop: '18px' } },
      row({ href: `#/tahak/${encodeURIComponent(next.id)}`, title: next.title, sub: 'Další téma' })) : null)
}
