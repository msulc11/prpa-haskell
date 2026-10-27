// Most mezi UI a interpretem: zvýraznění syntaxe, chybové karty, spouštění testů.
import { Session, tokenize } from '../hs/index.js'
import { h, esc } from './dom.js'

const KW_IDS = new Set(['otherwise'])

function tokenClass(t) {
  switch (t.type) {
    case 'kw': return 'tk-kw'
    case 'con': return 'tk-con'
    case 'num': return 'tk-num'
    case 'str': return 'tk-str'
    case 'char': return 'tk-char'
    case 'comment': return 'tk-comment'
    case 'op': case 'punct': return 'tk-op'
    case 'err': return 'tk-err'
    case 'id':
      if (KW_IDS.has(t.text)) return 'tk-kw'
      return t.col === 1 ? 'tk-fn' : ''
    default: return ''
  }
}

function safeTokens(src) {
  try {
    const toks = tokenize(src)
    if (toks.map(t => t.text).join('') === src) return toks
  } catch { /* spadne do prostého textu */ }
  return [{ type: 'ws', text: src, col: 2 }]
}

// HTML zvýrazněného kódu po řádcích (každý řádek je <span class="line">).
export function highlightLines(src, errLine = 0) {
  const lines = [[]]
  for (const t of safeTokens(src)) {
    const cls = tokenClass(t)
    const parts = t.text.split('\n')
    parts.forEach((part, i) => {
      if (i > 0) lines.push([])
      if (part) lines[lines.length - 1].push(cls ? `<span class="${cls}">${esc(part)}</span>` : esc(part))
    })
  }
  return lines.map((parts, i) =>
    `<span class="line${i + 1 === errLine ? ' err' : ''}">${parts.join('') || '​'}</span>`).join('')
}

export function highlight(src) {
  return safeTokens(src).map(t => {
    const cls = tokenClass(t)
    return cls ? `<span class="${cls}">${esc(t.text)}</span>` : esc(t.text)
  }).join('')
}

export function codeView(src) {
  return h('div', { class: 'code-view', html: highlight(src) })
}

const KIND = {
  parse: 'Chyba syntaxe',
  scope: 'Neznámé jméno',
  type: 'Typová chyba',
  runtime: 'Chyba za běhu',
  timeout: 'Výpočet trvá moc dlouho',
  stack: 'Přetečení zásobníku',
}

export function kindLabel(err) {
  return KIND[err?.kind] ?? 'Chyba'
}

export function errorCard(err, { title } = {}) {
  const where = err.line ? ` na řádku ${err.line}` : ''
  return h('div', { class: 'err-card' },
    h('b', null, title ?? `${kindLabel(err)}${err.where === 'expr' ? '' : where}`),
    err.message ? h('pre', null, err.message) : null,
    err.hint ? h('p', null, err.hint) : null)
}

export function shortError(err) {
  if (!err) return ''
  if (err.kind === 'runtime') return err.message.startsWith('***') ? err.message : `*** Exception: ${err.message}`
  return `${kindLabel(err)}: ${err.message}`
}

// Očekávané výstupy vygenerovaných úloh dopočítáme z referenčního řešení.
const refCache = new Map()
export function expectedFor(refCode, expr) {
  const key = refCode + '\u0000' + expr
  if (refCache.has(key)) return refCache.get(key)
  const s = new Session()
  const l = s.load(refCode)
  let out = null
  if (l.ok) {
    const r = s.eval(expr)
    out = r.ok ? r.output : shortError(r.error)
  }
  refCache.set(key, out)
  return out
}

export function resolvedTests(task) {
  const ref = task.solutions?.[0]?.code
  return task.tests.map(t => ({
    expr: t.expr,
    expected: t.expected ?? (ref ? expectedFor(ref, t.expr) : null),
  }))
}

// Načte kód a pustí testy. Vrací { loadError } nebo { results, passed, total }.
export function runTests(code, tests, { name } = {}) {
  const s = new Session()
  let load
  try { load = s.load(code) } catch (e) {
    load = { ok: false, error: { kind: 'runtime', message: String(e?.message ?? e), hint: 'Vnitřní chyba interpretu.' } }
  }
  if (!load.ok) return { loadError: load.error }
  if (name && load.names && !load.names.includes(name)) {
    return { loadError: { kind: 'scope', message: `Variable not in scope: ${name}`, hint: `V kódu chybí definice funkce ${name}. Zkontroluj, že se jmenuje přesně takhle (velikost písmen).` } }
  }
  const results = tests.map(t => {
    let r
    try { r = s.eval(t.expr) } catch (e) {
      r = { ok: false, error: { kind: 'runtime', message: String(e?.message ?? e) } }
    }
    const got = r.ok ? r.output : shortError(r.error)
    return { expr: t.expr, expected: t.expected, got, ok: r.ok && got === t.expected, error: r.ok ? null : r.error }
  })
  return { results, passed: results.filter(r => r.ok).length, total: results.length }
}

export function resultsGroup(results) {
  return h('div', { class: 'group res' }, results.map(r =>
    h('div', { class: 'row' },
      h('span', { class: `mark ${r.ok ? 'ok' : 'bad'}` }, r.ok ? '✓' : '✕'),
      h('span', { class: 'txt' }, r.expr,
        h('small', null, r.ok
          ? r.got
          : [`čekáno `, h('span', { class: 'mono' }, r.expected ?? '?'), `, dostal `, h('span', { class: 'mono' }, r.got)])))))
}

export function newSession() {
  return new Session()
}
