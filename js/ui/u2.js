// Úloha 2: najdi chybu (ťuknutím), vyber popis, oprav a ověř.
import { tokenize } from '../hs/index.js'
import { add, h, clear, nav, inlineCode } from './dom.js'
import { store } from './store.js'
import { loadList } from './app.js'
import { findTask, nextHref, position } from './lists.js'
import { codeView, errorCard, runTests, resultsGroup, newSession, shortError } from './hsx.js'
import { createEditor } from './editor.js'

export function spotRanges(task) {
  return task.spots.map(({ text, nth }) => {
    let idx = -1
    for (let k = 0; k <= nth; k++) {
      idx = task.code.indexOf(text, idx + 1)
      if (idx < 0) break
    }
    return idx < 0 ? null : [idx, idx + text.length]
  }).filter(Boolean)
}

export function codeTokens(code) {
  try {
    const t = tokenize(code)
    if (t.map(x => x.text).join('') === code) return t
  } catch { /* níž náhradní dělení */ }
  const out = []
  const re = /\s+|[A-Za-z_][\w']*|\d+(\.\d+)?|"[^"]*"|'[^']*'|[!#$%&*+./<=>?@\\^|\-~:]+|./g
  let m
  while ((m = re.exec(code))) out.push({ type: /^\s+$/.test(m[0]) ? 'ws' : 'x', text: m[0], start: m.index, end: m.index + m[0].length })
  return out
}

// Ťukací kód. onTap(hit, el) vrací, zda se má dál ťukat.
export function tapCode(task, onTap) {
  const ranges = spotRanges(task)
  const box = h('div', { class: 'tap-code', 'aria-label': 'Kód funkce, ťukni na chybu' })
  const buttons = []
  let active = true
  for (const t of codeTokens(task.code)) {
    if (t.type === 'ws' || t.type === 'nl' || !t.text.trim()) { add(box, t.text); continue }
    const hit = ranges.some(([a, b]) => t.start < b && t.end > a)
    const b = h('button', { class: 'tt', type: 'button' }, t.text)
    b.dataset.hit = hit ? '1' : ''
    b.addEventListener('click', () => {
      if (!active) return
      if (hit) b.classList.add('hit')
      else { b.classList.remove('miss'); void b.offsetWidth; b.classList.add('miss') }
      active = onTap(hit, b) !== false
    })
    buttons.push(b)
    add(box, b)
  }
  return {
    el: box,
    reveal() { for (const b of buttons) if (b.dataset.hit) b.classList.add('show'); active = false },
    stop() { active = false },
  }
}

export async function u2View(view, rawId) {
  const id = decodeURIComponent(rawId)
  const task = await findTask(2, id)
  if (!task) { location.replace('#/u/2'); return }
  const list = await loadList(2)

  const step1Msg = h('div')
  const step2 = h('div')
  const step3 = h('div')
  let misses = 0

  const tc = tapCode(task, (hit) => {
    if (hit) {
      add(clear(step1Msg), h('div', { class: 'ok-card' }, h('b', null, 'Ano, chyba je tady')))
      showQuestion()
      return false
    }
    misses++
    add(clear(step1Msg), h('div', { class: 'err-card' },
      h('b', null, misses === 1 ? 'Tady chyba není' : `Ani tady ne (${misses}×)`),
      misses >= 2 ? h('button', { class: 'linkbtn', type: 'button', onclick: () => { tc.reveal(); clear(step1Msg); showQuestion() } }, 'Ukázat, kde je chyba') : null))
    return true
  })

  function showQuestion() {
    if (step2.childElementCount) return
    let answered = false
    const rows = task.options.map((opt, i) => {
      const r = h('button', { class: 'row', type: 'button' },
        h('span', { class: 'radio' }),
        h('span', { class: 'txt', html: inlineCode(opt) }))
      r.addEventListener('click', () => {
        if (answered) return
        answered = true
        const ok = i === task.correct
        r.classList.add(ok ? 'correct' : 'wrongpick')
        r.querySelector('.radio').textContent = ok ? '✓' : '✕'
        if (!ok) {
          const c = rows[task.correct]
          c.classList.add('correct')
          c.querySelector('.radio').textContent = '✓'
        }
        add(explain,
          h('div', { class: ok ? 'ok-card' : 'err-card' },
            h('b', null, ok ? 'Správně' : 'Ne úplně'),
            h('p', { html: inlineCode(task.explanation) })),
          task.ghcError ? h('div', { class: 'card' },
            h('p', { class: 'sub', style: { marginTop: 0 } }, 'GHC hlásí'),
            h('pre', { class: 'mono', style: { margin: '6px 0 0', whiteSpace: 'pre-wrap', fontSize: '13.5px' } }, task.ghcError)) : null)
        showFix()
      })
      return r
    })
    const explain = h('div')
    add(step2,
      h('p', { class: 'group-title' }, task.question || 'V čem je chyba?'),
      h('div', { class: 'group opt' }, rows),
      explain)
  }

  function showFix() {
    const saved = store.code(task.id)
    const msg = h('div')
    const fixes = h('div')
    const ed = createEditor({ value: saved ?? task.code, minLines: 2, onChange: v => store.setCode(task.id, v === task.code ? '' : v) })

    function check() {
      clear(msg)
      document.activeElement?.blur()
      if (ed.value.trim() === task.code.trim()) {
        add(msg, h('div', { class: 'err-card' }, h('b', null, 'Kód je pořád stejný jako v zadání'), h('p', null, 'Uprav ho v editoru a pak zkontroluj.')))
        return
      }
      const r = runTests(ed.value, task.tests ?? [])
      if (r.loadError) {
        ed.setErrorLine(r.loadError.where === 'expr' ? 0 : r.loadError.line)
        add(msg, errorCard(r.loadError))
        return
      }
      if (task.use && !(task.tests ?? []).length) {
        const s = newSession()
        s.load(ed.value)
        const u = s.eval(task.use)
        if (!u.ok) { add(msg, errorCard(u.error, { title: `Při volání ${task.use}: ${shortError(u.error).split(':')[0]}` })); return }
      }
      const allOk = r.passed === r.total
      if (allOk) store.markSolved(task.id)
      add(msg,
        h('div', { class: allOk ? 'ok-card' : 'err-card' },
          h('b', null, allOk ? (r.total ? `Opraveno, ${r.passed} z ${r.total} testů prošlo` : 'Opraveno, kód se přeloží') : `${r.passed} z ${r.total} testů prošlo`)),
        r.total ? [h('p', { class: 'group-title' }, 'Testy'), resultsGroup(r.results)] : null,
        allOk ? h('div', { class: 'actions', style: { marginTop: '16px' } },
          h('button', { class: 'btn', type: 'button', onclick: async () => { location.hash = await nextHref(2, task.id) } }, 'Další chyba')) : null)
    }

    add(step3,
      h('p', { class: 'group-title' }, 'Oprav funkci'),
      ed.el,
      h('div', { class: 'actions' },
        h('button', { class: 'btn sec', type: 'button', onclick: () => {
          add(clear(fixes),
            h('p', { class: 'group-title' }, task.fixes.length > 1 ? 'Možné opravy' : 'Oprava'),
            task.fixes.map(f => codeView(f)))
        } }, 'Ukázat opravu'),
        h('button', { class: 'btn', type: 'button', onclick: check }, 'Zkontrolovat')),
      msg,
      fixes)
  }

  add(clear(view),
    nav(task.name, { back: '#/u/2', backLabel: 'Úloha 2', right: position(list, task.id) }),
    h('div', { class: 'card' },
      h('p', { html: `Ve funkci <code>${task.name}</code> je právě jedna chyba. Najděte a popište ji a pak se ji pokuste opravit.` }),
      task.source ? h('p', { class: 'sub' }, task.source) : null),
    h('p', { class: 'group-title' }, 'Ťukni na místo, kde je chyba'),
    tc.el,
    step1Msg,
    step2,
    step3)
}
