// Cvičná písemka: 4 úlohy, 10 bodů, opravení po odevzdání.
import { exprTree, parenthesize, Session } from '../hs/index.js'
import { add, h, clear, nav, inlineCode, esc, rngFrom, newSeed } from './dom.js'
import { store } from './store.js'
import { loadList } from './app.js'
import { EXAM_TEXT } from './lists.js'
import { checkParens } from './u1.js'
import { spotRanges, codeTokens } from './u2.js'
import { codeView, errorCard, runTests, resolvedTests, resultsGroup, newSession, highlight } from './hsx.js'
import { createEditor } from './editor.js'

const POINTS = { 1: 2, 2: 2, 3: 3, 4: 3 }

async function pick(n, rng) {
  const list = await loadList(n)
  const fromList = () => list[Math.floor(rng() * list.length)]
  if (n === 2) return fromList()
  const gen = n === 1 ? (await import('../data/uloha1.js')).generate
    : n === 3 ? (await import('../data/uloha3.js')).generate
    : (await import('../data/uloha4.js')).generate
  if (rng() < 0.5) return fromList()
  return { ...gen(rng), generated: true }
}

async function newExam() {
  const seed = newSeed()
  const rng = rngFrom(seed)
  const tasks = {}
  for (const n of [1, 2, 3, 4]) tasks[n] = await pick(n, rng)
  const exam = { seed, startedAt: Date.now(), tasks, answers: { value: '', parens: tasks[1].expr, spot: -1, fix: tasks[2].code, desc: '', code3: '', code4: '' } }
  store.set('exam', exam)
  return exam
}

function grade(exam) {
  const { tasks, answers } = exam
  const out = {}

  // 1: hodnota + závorky
  const t1 = tasks[1]
  const s = new Session()
  const ev = s.eval(t1.expr)
  const value = t1.value ?? (ev.ok ? ev.output : '?')
  const valueOk = answers.value.replace(/\s+/g, '') === value.replace(/\s+/g, '')
  const tree = exprTree(t1.expr)
  const hasOps = tree.ok && !['lit', 'var'].includes(tree.tree.kind)
  const pr = hasOps ? checkParens(t1.expr, answers.parens) : { ok: true }
  out[1] = { points: (valueOk ? 1 : 0) + (pr.ok ? 1 : 0), valueOk, value, parensOk: pr.ok, want: t1.parens ?? (tree.ok ? parenthesize(t1.expr) : t1.expr) }

  // 2: místo chyby + oprava
  const t2 = tasks[2]
  const ranges = spotRanges(t2)
  const toks = codeTokens(t2.code)
  const tok = toks[answers.spot]
  const spotOk = !!tok && ranges.some(([a, b]) => tok.start < b && tok.end > a)
  let fixOk = false
  let fixRes = null
  if (answers.fix.trim() && answers.fix.trim() !== t2.code.trim()) {
    fixRes = runTests(answers.fix, t2.tests ?? [])
    fixOk = !fixRes.loadError && fixRes.passed === fixRes.total
    if (fixOk && t2.use && !(t2.tests ?? []).length) {
      const ss = newSession()
      ss.load(answers.fix)
      fixOk = ss.eval(t2.use).ok
    }
  }
  out[2] = { points: (spotOk ? 1 : 0) + (fixOk ? 1 : 0), spotOk, fixOk, fixRes }

  // 3 a 4: testy
  for (const n of [3, 4]) {
    const t = tasks[n]
    const code = answers[`code${n}`]
    if (!code.trim()) { out[n] = { points: 0, empty: true }; continue }
    const r = runTests(code, resolvedTests(t), { name: t.name })
    let points = 0
    if (!r.loadError) {
      const ratio = r.passed / r.total
      points = ratio === 1 ? 3 : ratio >= 2 / 3 ? 2 : ratio >= 1 / 3 ? 1 : 0
    }
    out[n] = { points, res: r }
  }
  out.total = [1, 2, 3, 4].reduce((a, n) => a + out[n].points, 0)
  return out
}

function minutes(exam) {
  return Math.max(0, Math.round((Date.now() - exam.startedAt) / 60000))
}

export async function examView(view) {
  let exam = store.get('exam', null)
  if (exam?.graded) return renderGraded(view, exam)
  if (!exam) return renderIntro(view)
  return renderWriting(view, exam)
}

function renderIntro(view) {
  const history = store.get('examHistory', [])
  add(clear(view),
    nav('Cvičná písemka', { back: null }),
    h('div', { class: 'card' },
      h('h3', null, 'Jako na papíře'),
      h('p', null, 'Čtyři úlohy za 10 bodů: výraz a závorky (2), oprava chyby (2), funkce s podmínkami (3), funkce nad seznamem (3).'),
      h('p', null, 'Během psaní nic nekontroluju. Testy, body a řešení uvidíš až po odevzdání.')),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: async () => { await newExam(); examView(view) } }, 'Začít psát')),
    history.length ? [
      h('p', { class: 'group-title' }, 'Předchozí pokusy'),
      h('div', { class: 'group' }, history.slice(-8).reverse().map(e =>
        h('div', { class: 'row' }, h('span', { class: 'txt' }, new Date(e.at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })), h('span', { class: 'det' }, `${e.score} / 10`)))),
    ] : null)
}

function section(n, ...children) {
  return [
    h('div', { class: 'exam-head' }, h('h2', null, `Úloha ${n}`), h('span', null, `${POINTS[n]} body`)),
    ...children,
  ]
}

function renderWriting(view, exam) {
  const { tasks, answers } = exam
  const save = () => store.set('exam', exam)
  const timeEl = h('span', null, `${minutes(exam)} min`)
  const timer = setInterval(() => {
    if (!timeEl.isConnected) return clearInterval(timer)
    timeEl.textContent = `${minutes(exam)} min`
  }, 20000)

  const field = (key, placeholder, label) => {
    const inp = h('input', {
      class: 'input code-input', type: 'text', placeholder, value: answers[key], 'aria-label': label,
      autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false',
    })
    inp.addEventListener('input', () => { answers[key] = inp.value; save() })
    return h('div', { class: 'group', style: { marginTop: '10px' } }, h('div', { class: 'field' }, h('label', null, label), inp))
  }

  // Výběr místa chyby bez okamžité zpětné vazby.
  const tapBox = h('div', { class: 'tap-code' })
  const toks = codeTokens(tasks[2].code)
  toks.forEach((t, i) => {
    if (!t.text.trim()) { add(tapBox, t.text); return }
    const b = h('button', { class: `tt${answers.spot === i ? ' hit' : ''}`, type: 'button' }, t.text)
    b.addEventListener('click', () => {
      answers.spot = answers.spot === i ? -1 : i
      for (const x of tapBox.querySelectorAll('.tt')) x.classList.remove('hit')
      if (answers.spot === i) b.classList.add('hit')
      save()
    })
    add(tapBox, b)
  })

  const ed2 = createEditor({ value: answers.fix, minLines: 2, onChange: v => { answers.fix = v; save() } })
  const ed3 = createEditor({ value: answers.code3, minLines: 5, placeholder: `${tasks[3].signature ?? tasks[3].name} = …`, onChange: v => { answers.code3 = v; save() } })
  const ed4 = createEditor({ value: answers.code4, minLines: 5, placeholder: `${tasks[4].signature ?? tasks[4].name} = …`, onChange: v => { answers.code4 = v; save() } })

  const discard = h('button', { class: 'btn sec', type: 'button' }, 'Zahodit')
  discard.addEventListener('click', () => {
    if (!discard.dataset.c) { discard.dataset.c = '1'; discard.textContent = 'Opravdu zahodit?'; return }
    store.set('exam', null)
    renderIntro(view)
  })

  let confirm = false
  const submit = h('button', { class: 'btn', type: 'button' }, 'Odevzdat')
  submit.addEventListener('click', () => {
    if (!confirm) { confirm = true; submit.textContent = 'Opravdu odevzdat?'; return }
    exam.graded = grade(exam)
    exam.finishedAt = Date.now()
    store.set('exam', exam)
    const history = store.get('examHistory', [])
    history.push({ score: exam.graded.total, at: exam.finishedAt })
    store.set('examHistory', history.slice(-30))
    renderGraded(view, exam)
    window.scrollTo(0, 0)
  })

  add(clear(view),
    nav('Písemka', { back: null, right: timeEl }),
    section(1,
      h('div', { class: 'card' }, h('p', null, EXAM_TEXT[1])),
      h('div', { class: 'expr', html: highlight(tasks[1].expr) }),
      field('value', 'hodnota', 'Výsledek'),
      field('parens', '', 'Závorky')),
    section(2,
      h('div', { class: 'card' }, h('p', { html: `Ve funkci <code>${esc(tasks[2].name)}</code> je právě jedna chyba. Najděte a popište ji a pak se ji pokuste opravit.` })),
      h('p', { class: 'note' }, 'Ťukni na místo chyby:'),
      tapBox,
      field('desc', 'krátce, nehodnotí se', 'Popis'),
      h('p', { class: 'note' }, 'Opravená funkce:'),
      ed2.el),
    section(3, h('div', { class: 'card' }, h('p', { html: inlineCode(tasks[3].text) })), ed3.el),
    section(4, h('div', { class: 'card' }, h('p', { html: inlineCode(tasks[4].text) })), ed4.el),
    h('div', { class: 'actions', style: { marginTop: '24px' } },
      discard,
      submit))
  return () => clearInterval(timer)
}

function renderGraded(view, exam) {
  const { tasks, answers, graded: g } = exam
  const pts = n => h('span', null, `${g[n].points} z ${POINTS[n]} b.`)
  const head = n => h('div', { class: 'exam-head' }, h('h2', null, `Úloha ${n}`), pts(n))
  const line = (ok, text) => h('div', { class: 'row' }, h('span', { class: `mark ${ok ? 'ok' : 'bad'}` }, ok ? '✓' : '✕'), h('span', { class: 'txt', html: text }))

  const t2ranges = spotRanges(tasks[2])
  const parts = [
    nav('Výsledek', { back: null, right: exam.finishedAt ? `${Math.round((exam.finishedAt - exam.startedAt) / 60000)} min` : '' }),
    h('div', { class: 'card', style: { textAlign: 'center' } },
      h('div', { class: 'score' }, String(g.total), h('small', null, ' / 10')),
      h('p', { class: 'sub' }, g.total >= 8 ? 'Výborně.' : g.total >= 5 ? 'Dobrý základ, projdi si chyby níže.' : 'Projdi si řešení a zkus to znovu.')),

    head(1),
    h('div', { class: 'expr', html: highlight(tasks[1].expr) }),
    h('div', { class: 'group res' },
      line(g[1].valueOk, `Výsledek: <code>${esc(answers.value || '–')}</code>${g[1].valueOk ? '' : `, správně <code>${esc(g[1].value)}</code>`}`),
      line(g[1].parensOk, `Závorky: <code>${esc(answers.parens || '–')}</code>${g[1].parensOk ? '' : `<br>správně <code>${esc(g[1].want)}</code>`}`)),

    head(2),
    h('div', { class: 'code-view', html: highlight(tasks[2].code) }),
    h('div', { class: 'group res' },
      line(g[2].spotOk, g[2].spotOk ? 'Místo chyby správně' : `Místo chyby: správně <code>${esc(t2ranges.map(([a, b]) => tasks[2].code.slice(a, b)).join(' / '))}</code>`),
      line(g[2].fixOk, g[2].fixOk ? 'Oprava funguje' : 'Oprava neprošla')),
    g[2].fixRes?.loadError ? errorCard(g[2].fixRes.loadError) : null,
    h('div', { class: 'hint-card' }, h('b', null, 'Vysvětlení'), h('span', { html: inlineCode(tasks[2].explanation) })),
    h('p', { class: 'group-title' }, 'Oprava'),
    tasks[2].fixes.map(f => codeView(f)),
  ]

  for (const n of [3, 4]) {
    const t = tasks[n]
    const r = g[n]
    parts.push(
      head(n),
      h('div', { class: 'card' }, h('p', { html: inlineCode(t.text) })),
      r.empty ? h('div', { class: 'err-card' }, h('b', null, 'Nevyplněno'))
        : r.res.loadError ? errorCard(r.res.loadError)
        : [h('p', { class: 'group-title' }, `Testy · ${r.res.passed} z ${r.res.total}`), resultsGroup(r.res.results)],
      h('p', { class: 'group-title' }, 'Tvůj kód'),
      codeView(answers[`code${n}`] || '-- nic'),
      h('p', { class: 'group-title' }, 'Řešení'),
      (t.solutions ?? []).slice(0, 2).map(s => [h('p', { class: 'note' }, s.label), codeView(s.code)]))
  }

  parts.push(h('div', { class: 'actions', style: { marginTop: '24px' } },
    h('button', { class: 'btn', type: 'button', onclick: async () => { await newExam(); examView(view); window.scrollTo(0, 0) } }, 'Nová písemka')))
  add(clear(view), ...parts)
}
