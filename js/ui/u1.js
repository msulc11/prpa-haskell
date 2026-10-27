// Úloha 1: hodnota výrazu + pořadí vyhodnocení (= závorky).
import { exprTree, parenthesize, evalSteps, sameStructure, Session } from '../hs/index.js'
import { add, h, clear, nav, esc, inlineCode } from './dom.js'
import { store } from './store.js'
import { loadList } from './app.js'
import { findTask, nextHref, position, EXAM_TEXT } from './lists.js'
import { highlight, errorCard } from './hsx.js'

// Operace ve stromu = místa, na která se ťuká (operátor, hlava aplikace, unární minus).
export function operations(tree) {
  const ops = []
  const walk = (node, parent) => {
    if (!node || typeof node !== 'object') return
    let me = parent
    if (node.kind === 'op' || node.kind === 'neg') me = { start: node.opStart, end: node.opEnd, node, children: [] }
    else if (node.kind === 'app') me = { start: node.headStart, end: node.headEnd, node, children: [] }
    if (me !== parent) { ops.push(me); parent?.children.push(me) }
    if (node.kind === 'app') {
      // Částečná aplikace v hlavě („(subtract 3) 10“) je jedna operace, ne dvě.
      let fn = node.fn
      while (fn?.kind === 'app') { for (const a of fn.args ?? []) walk(a, me); fn = fn.fn }
      walk(fn, me)
      for (const a of node.args ?? []) walk(a, me)
      return
    }
    for (const k of ['left', 'right', 'arg']) if (node[k]) walk(node[k], me)
  }
  walk(tree, null)
  // Operace schované uvnitř hlavy jiné operace se nedají ťuknout zvlášť.
  for (const o of ops) {
    o.hidden = !(o.end > o.start) || ops.some(p => p !== o && p.start <= o.start && o.end <= p.end && (p.end - p.start) > (o.end - o.start))
  }
  return ops.filter(o => !o.hidden)
}

function descendants(op) {
  const out = []
  const walk = o => { for (const c of o.children) { if (!c.hidden) out.push(c); walk(c) } }
  walk(op)
  return out
}

// Pořadí je správné, když každá operace přijde až po všech operacích uvnitř svých operandů.
export function orderOk(ops, picked) {
  const at = new Map(picked.map((o, i) => [o, i]))
  return ops.every(o => descendants(o).every(d => at.get(d) < at.get(o)))
}

function normalize(s) {
  return s.replace(/\s+/g, '')
}

// Uživatelův zápis se závorkami: stejný strom a závorky kolem každé dílčí operace.
export function checkParens(expr, typed) {
  if (!typed.trim()) return { ok: false, empty: true }
  const want = parenthesize(expr)
  if (!exprTree(typed).ok) return { ok: false, want, unreadable: true }
  if (!sameStructure(expr, typed)) return { ok: false, want }
  const t = normalize(typed)
  const w = normalize(want)
  return { ok: t === w || t === `(${w})`, want, missing: true }
}

function sameValue(got, want) {
  const a = got.trim().replace(/\s+/g, '')
  return a === want.replace(/\s+/g, '')
}

export async function u1View(view, rawId) {
  const id = decodeURIComponent(rawId)
  const task = await findTask(1, id)
  if (!task) { location.replace('#/u/1'); return }
  const list = await loadList(1)

  const treeRes = exprTree(task.expr)
  const s = new Session()
  const ev = s.eval(task.expr)
  const value = task.value ?? (ev.ok ? ev.output : '?')
  const want = task.parens ?? (treeRes.ok ? parenthesize(task.expr) : task.expr)
  const steps = evalSteps(task.expr)
  const ops = treeRes.ok ? operations(treeRes.tree) : []

  const picked = []
  let orderDone = ops.length === 0
  let valueDone = false
  let parensChecked = false

  const exprBox = h('div', { class: 'expr', 'aria-label': 'Výraz' })
  const orderMsg = h('div')
  const valueMsg = h('div')
  const after = h('div')
  const typedParens = h('input', {
    class: 'input code-input', type: 'text', placeholder: 'např. 1 + ((2 ^ 3) * 4)',
    autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Výraz se závorkami',
  })
  const parensMsg = h('div')
  const valueInput = h('input', {
    class: 'input code-input', type: 'text', placeholder: 'výsledek', inputmode: 'text',
    autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Výsledná hodnota',
  })

  function renderExpr(state) {
    const src = task.expr
    const parts = []
    let pos = 0
    const sorted = [...ops].sort((a, b) => a.start - b.start)
    for (const o of sorted) {
      if (o.start < pos) continue
      parts.push(h('span', { html: highlight(src.slice(pos, o.start)) }))
      const idx = picked.indexOf(o)
      let cls = 'opb'
      if (state === 'checked') cls += idx >= 0 ? (o.correct ? ' good' : ' wrong') : ''
      else if (idx >= 0) cls += ' picked'
      const b = h('button', { class: cls, type: 'button', 'aria-label': `operace ${src.slice(o.start, o.end)}` },
        src.slice(o.start, o.end), idx >= 0 ? h('i', null, String(idx + 1)) : null)
      b.addEventListener('click', () => tap(o))
      parts.push(b)
      pos = o.end
    }
    parts.push(h('span', { html: highlight(src.slice(pos)) }))
    add(clear(exprBox), ...parts)
  }

  function tap(o) {
    if (orderDone) return
    const i = picked.indexOf(o)
    if (i >= 0) {
      if (i === picked.length - 1) picked.pop()
    } else picked.push(o)
    if (picked.length === ops.length) checkOrder()
    else renderExpr('picking')
  }

  function checkOrder() {
    orderDone = true
    const ok = orderOk(ops, picked)
    // Obarvení: operace je „dobře“, pokud všechny její vnitřní operace přišly dřív.
    const at = new Map(picked.map((o, i) => [o, i]))
    for (const o of ops) o.correct = descendants(o).every(d => at.get(d) < at.get(o))
    renderExpr('checked')
    add(clear(orderMsg), ok
      ? h('div', { class: 'ok-card' }, h('b', null, 'Pořadí sedí'), h('p', { html: `Se závorkami: <code>${esc(want)}</code>` }))
      : h('div', { class: 'err-card' }, h('b', null, 'Pořadí nesedí'),
          h('p', { html: `Správně se závorkami: <code>${esc(want)}</code>` }),
          h('button', { class: 'linkbtn', type: 'button', onclick: resetOrder }, 'Zkusit znovu')))
    progress(ok ? 'order' : null)
  }

  function resetOrder() {
    picked.length = 0
    orderDone = false
    clear(orderMsg)
    renderExpr('picking')
  }

  const solvedParts = new Set()
  function progress(part) {
    if (part) solvedParts.add(part)
    if ((orderDone || parensChecked) && valueDone) showAfter()
    if ((solvedParts.has('order') || solvedParts.has('parens') || ops.length === 0) && solvedParts.has('value')) store.markSolved(task.id)
  }

  function checkValue() {
    const v = valueInput.value
    if (!v.trim()) return
    valueDone = true
    const ok = sameValue(v, value)
    let tip = ''
    if (!ok && /^(true|false)$/i.test(v.trim()) && /^(True|False)$/.test(value)) tip = 'Pozor na velké písmeno: v Haskellu je True a False.'
    add(clear(valueMsg), ok
      ? h('div', { class: 'ok-card' }, h('b', null, 'Správně'), h('p', { html: `Výsledek je <code>${esc(value)}</code>.` }))
      : h('div', { class: 'err-card' }, h('b', null, 'Špatně'),
          h('p', { html: `Výsledek je <code>${esc(value)}</code>.${tip ? ' ' + esc(tip) : ''}` })))
    progress(ok ? 'value' : null)
  }

  function checkTyped() {
    const r = checkParens(task.expr, typedParens.value)
    if (r.empty) return
    parensChecked = true
    add(clear(parensMsg), r.ok
      ? h('div', { class: 'ok-card' }, h('b', null, 'Závorky sedí'))
      : h('div', { class: 'err-card' },
          h('b', null, r.unreadable ? 'Zápis nejde přečíst, zkontroluj párování závorek' : r.missing ? 'Struktura sedí, ale některé závorky chybí' : 'Závorky mění pořadí výpočtu'),
          h('p', { html: `Správně: <code>${esc(r.want)}</code>` })))
    progress(r.ok ? 'parens' : null)
  }

  function showAfter() {
    if (after.childElementCount) return
    add(after,
      task.note ? h('div', { class: 'hint-card' }, h('b', null, 'Proč'), h('span', { html: inlineCode(task.note) })) : null,
      steps.ok ? [
        h('p', { class: 'group-title' }, 'Postup výpočtu'),
        h('div', { class: 'group' }, h('ol', { class: 'steps' },
          steps.steps.map((st, i) => h('li', null, h('span', null, i === 0 ? 'výraz' : `${i}.`), st)))),
      ] : null,
      h('div', { class: 'actions', style: { marginTop: '18px' } },
        h('button', { class: 'btn', type: 'button', onclick: async () => { location.hash = await nextHref(1, task.id) } }, 'Další výraz')))
  }

  valueInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); checkValue() } })
  typedParens.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); checkTyped() } })

  renderExpr('picking')
  add(clear(view),
    nav('Výraz', { back: '#/u/1', backLabel: 'Úloha 1', right: position(list, task.id) }),
    h('div', { class: 'card' }, h('p', null, EXAM_TEXT[1]), task.source ? h('p', { class: 'sub' }, task.source) : null),
    exprBox,
    !treeRes.ok ? errorCard(treeRes.error) : null,
    ops.length ? h('p', { class: 'note' }, 'Ťukej na operace v pořadí, v jakém se vyhodnotí. Posledním ťuknutím se pořadí zkontroluje, poslední volbu vrátíš dalším ťuknutím.') : null,
    orderMsg,
    h('p', { class: 'group-title' }, 'Výsledná hodnota'),
    h('div', { class: 'group' }, h('div', { class: 'field' }, valueInput)),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: checkValue }, 'Zkontrolovat')),
    valueMsg,
    ops.length ? [
      h('p', { class: 'group-title' }, 'Nebo napiš výraz se všemi závorkami'),
      h('div', { class: 'group' }, h('div', { class: 'field' }, typedParens)),
      h('div', { class: 'actions' }, h('button', { class: 'btn sec grow', type: 'button', onclick: checkTyped }, 'Zkontrolovat závorky')),
      parensMsg,
    ] : null,
    after)
}
